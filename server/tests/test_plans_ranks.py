"""Levels, sides and ranks, and the optional personal plan."""
from datetime import date, datetime, timedelta

import pytest

import app as A
import config
import data
import db
from conftest import TODAY, make_user, put_steps

MONDAY = TODAY - timedelta(days=TODAY.weekday())      # Mon 12 Oct 2026


def earn(conn, uid, amount, reason="Mini challenge: x", at=None):
    conn.execute("INSERT INTO exp_ledger (user_id, amount, reason, created_at) VALUES (?, ?, ?, ?)",
                 (uid, amount, reason, at or f"{TODAY}T10:00:00+04:00"))
    conn.commit()


def finish(conn, uid, key, day):
    """A finished mini run of `key` on `day` (what ticks a plan task off)."""
    conn.execute("INSERT INTO mini_runs (user_id, key, date, status, started_at, finished_at) "
                 "VALUES (?, ?, ?, 'done', ?, ?)", (uid, key, day.isoformat(), f"{day}T09:00:00+04:00",
                                                    f"{day}T09:05:00+04:00"))
    conn.commit()


# ------------------------------------------------------------------ levels

def test_level_curve():
    assert data.level_from_exp(0)["level"] == 1
    assert data.level_from_exp(99)["level"] == 1
    assert data.level_from_exp(100)["level"] == 2
    assert data.level_from_exp(700)["level"] == config.SIDE_LEVEL == 5
    assert data.level_from_exp(2700)["level"] == 10
    top = data.level_from_exp(10 ** 7)
    assert top["level"] == config.LEVEL_MAX and top["max"] and top["percent"] == 100
    mid = data.level_from_exp(150)        # level 2 needs 150 more for level 3
    assert (mid["into"], mid["need"], mid["to_next"], mid["percent"]) == (50, 150, 100, 33)


def test_spending_and_refunds_never_change_the_level(conn):
    uid = make_user(conn)
    earn(conn, uid, 800)
    earn(conn, uid, -700, "Bought crown")
    earn(conn, uid, 1000, "refund: shoes left the shop")
    assert data.lifetime_exp(conn, uid) == 800
    assert data.level_info(conn, uid)["level"] == 5


def test_ranks_follow_the_level_and_side():
    assert data.rank_for(4, None)["name"] == config.UNSORTED_RANK
    assert data.rank_for(5, None)["name"] == config.UNSORTED_RANK      # no side picked yet
    assert data.rank_for(5, "reaper")["name"] == "Lost Soul"
    assert data.rank_for(9, "strider")["name"] == "Bystander"
    r = data.rank_for(10, "strider")
    assert (r["name"], r["next_name"], r["next_level"]) == ("Sidekick", "Masked", 17)
    assert data.rank_for(50, "reaper")["name"] == "Reaper"
    assert data.rank_for(50, "reaper")["next_name"] is None


def test_picking_a_side_needs_level_5_and_can_switch(conn):
    uid = make_user(conn)
    earn(conn, uid, 699)
    with pytest.raises(ValueError):
        data.set_side(conn, uid, "reaper")
    earn(conn, uid, 1)
    info = data.level_info(conn, uid)
    assert info["must_pick"] and info["rank"]["name"] == config.UNSORTED_RANK
    data.set_side(conn, uid, "reaper")
    assert data.level_info(conn, uid)["rank"]["name"] == "Lost Soul"
    data.set_side(conn, uid, "strider")                   # switching is free
    info = data.level_info(conn, uid)
    assert info["rank"]["name"] == "Bystander" and info["level"] == 5 and not info["must_pick"]
    with pytest.raises(ValueError):
        data.set_side(conn, uid, "villain")


def test_ranks_for_many_people(conn):
    a, b = make_user(conn, "amal"), make_user(conn, "bobby")
    earn(conn, a, 2700)
    data.set_side(conn, a, "reaper")
    got = data.ranks_for(conn, [a, b, None])
    assert got[a] == {"level": 10, "side": "reaper", "rank": "Wisp"}
    assert got[b] == {"level": 1, "side": None, "rank": config.UNSORTED_RANK}


# ------------------------------------------------------------------ plan

def plan_for(conn, uid, **answers):
    a = {"activity": "new", "days": 3, "minutes": 10, "focus": "mix", "avoid": []}
    a.update(answers)
    data.save_plan(conn, uid, a["activity"], a["days"], a["minutes"], a["focus"], a["avoid"], TODAY)
    return data.get_plan(conn, uid)


def test_plan_needs_valid_answers(conn):
    uid = make_user(conn)
    for bad in ({"activity": "lazy"}, {"days": 7}, {"days": "x"}, {"minutes": 15}, {"focus": "abs"}):
        with pytest.raises(ValueError):
            plan_for(conn, uid, **bad)
    assert data.get_plan(conn, uid) is None
    p = plan_for(conn, uid, avoid=["planks", "made-up", "pushups"])
    assert p["avoid"] == "planks,pushups"            # unknown choices are dropped


def test_training_days_rest_days_and_task_counts(conn):
    uid = make_user(conn)
    for days, weekdays in config.PLAN_WEEKDAYS.items():
        for minutes, n in config.PLAN_MINUTES.items():
            p = plan_for(conn, uid, days=days, minutes=minutes)
            for i in range(7):
                tasks = data.plan_tasks(p, MONDAY + timedelta(days=i))
                assert len(tasks) == (n if i in weekdays else 0)
                assert all(k in config.MINI_CHALLENGES for k in tasks)
                # never more than the daily limit of one challenge, never 3+ of one exercise
                assert all(tasks.count(k) <= config.MINI_DAILY_LIMIT for k in tasks)
                tracks = [config.MINI_CHALLENGES[k]["track"] for k in tasks]
                assert all(tracks.count(t) <= 2 for t in tracks if t != "steps")


def test_skipped_moves_never_appear(conn):
    uid = make_user(conn)
    p = plan_for(conn, uid, days=6, minutes=20, focus="strength", avoid=["pushups", "jumping"])
    tracks = {config.MINI_CHALLENGES[k]["track"] for i in range(7)
              for k in data.plan_tasks(p, MONDAY + timedelta(days=i))}
    assert not tracks & {"pushups", "jumping_jacks"} and tracks
    p = plan_for(conn, uid, focus="strength", avoid=list(config.PLAN_AVOID))
    assert {config.MINI_CHALLENGES[k]["track"] for k in data.plan_tasks(p, MONDAY)} == {"steps"}


def test_how_active_sets_the_starting_size(conn):
    uid = make_user(conn)
    sizes = {}
    for activity in ("new", "some", "very"):
        p = plan_for(conn, uid, activity=activity, focus="strength")
        sizes[activity] = sum(config.MINI_CHALLENGES[k]["amount"] for k in data.plan_tasks(p, MONDAY))
    assert sizes["new"] < sizes["some"] < sizes["very"]


def test_finished_challenges_tick_off_todays_tasks(conn):
    uid = make_user(conn)
    p = plan_for(conn, uid, days=3, minutes=10)      # Mon/Wed/Fri; TODAY is a Wednesday
    keys = data.plan_tasks(p, TODAY)
    state = data.plan_state(conn, uid, TODAY)
    assert (state["done"], state["total"]) == (0, len(keys))
    finish(conn, uid, keys[0], TODAY)
    finish(conn, uid, "planks_60" if keys[0] != "planks_60" else "squats_30", TODAY - timedelta(days=1))  # yesterday: no tick
    state = data.plan_state(conn, uid, TODAY)
    assert state["done"] == 1 and state["today"][0]["done"]
    today = next(d for d in state["week"] if d["today"])
    assert today["date"] == TODAY.isoformat() and not today["rest"]
    assert next(d for d in state["week"] if d["date"] == (TODAY + timedelta(days=1)).isoformat())["rest"]


def test_a_good_week_steps_up_and_a_quiet_week_eases_off(conn):
    uid = make_user(conn)
    p = plan_for(conn, uid, activity="some", days=2, minutes=5)       # step 1, Mon + Thu
    for i in range(7):                                                # finish everything this week
        day = MONDAY + timedelta(days=i)
        for k in data.plan_tasks(p, day):
            finish(conn, uid, k, day)
    next_week = TODAY + timedelta(days=7)
    state = data.plan_state(conn, uid, next_week)
    assert state["plan"]["step"] == 2 and state["change"] == "up"
    assert data.plan_state(conn, uid, next_week)["plan"]["step"] == 2   # reviewed once a week only
    state = data.plan_state(conn, uid, next_week + timedelta(days=7))   # nothing done that week
    assert state["plan"]["step"] == 1 and state["change"] == "down"


def test_days_before_the_plan_started_dont_count(conn):
    uid = make_user(conn)
    plan_for(conn, uid, activity="new")       # made this week: next week's review has only part of a week
    conn.execute("UPDATE plans SET created_at = ? WHERE user_id = ?", (f"{MONDAY + timedelta(days=6)}T20:00:00+04:00", uid))
    conn.commit()
    state = data.plan_state(conn, uid, TODAY + timedelta(days=7))
    assert state["plan"]["step"] == 0 and state["change"] is None     # Sunday is a rest day: nothing to judge


def test_stopping_and_exporting_and_deleting(conn):
    uid = make_user(conn)
    plan_for(conn, uid)
    assert data.export_my_data(conn, uid)["plans"][0]["focus"] == "mix"
    data.stop_plan(conn, uid)
    assert data.plan_state(conn, uid, TODAY) is None
    plan_for(conn, uid)
    conn.execute("DELETE FROM users WHERE id = ?", (uid,))
    conn.commit()
    assert conn.execute("SELECT COUNT(*) FROM plans").fetchone()[0] == 0


# ------------------------------------------------------------------ pages

@pytest.fixture
def web(tmp_path):
    w = A.create_app()
    path = str(tmp_path / "web.sqlite3")
    w.config.update(TESTING=True, DATABASE=path)
    c = db.connect(path)
    db.create_tables(c)
    uid = data.create_user(c, "sam", "Sam Lee", "student", "Grade 9A", "teen_13_17", "1234")
    c.close()
    return w, path, uid


def signed_in(w, uid):
    client = w.test_client()
    with client.session_transaction() as s:
        s["user_id"] = uid
        s["csrf"] = "x"
    return client


def test_home_offers_a_plan_and_shows_the_level(web):
    w, _, uid = web
    page = signed_in(w, uid).get("/").data.decode()
    assert "Make my plan" in page and 'id="level-h"' in page and "Level 1" in page
    assert "Lv 1 · Unsorted" in page


def test_making_a_plan_from_the_setup_page(web):
    w, path, uid = web
    c = signed_in(w, uid)
    assert 'value="plan_save"' in c.get("/plan").data.decode()
    r = c.post("/plan", data={"csrf": "x", "action": "plan_save", "activity": "some", "days": "4",
                              "minutes": "20", "focus": "strength", "avoid": ["planks"]})
    assert r.status_code == 302
    conn = db.connect(path)
    p = data.get_plan(conn, uid)
    assert (p["activity"], p["days"], p["minutes"], p["focus"], p["avoid"]) == ("some", 4, 20, "strength", "planks")
    page = c.get("/plan").data.decode()
    assert "4 days a week · 20 minutes · get stronger" in page and "Skipping: Planks" in page
    home = c.get("/").data.decode()
    assert ("Today's plan" in home) and "Make my plan" not in home
    c.post("/plan", data={"csrf": "x", "action": "plan_stop"})
    assert data.get_plan(conn, uid) is None


def test_bad_setup_answers_show_an_error(web):
    w, path, uid = web
    c = signed_in(w, uid)
    r = c.post("/plan", data={"csrf": "x", "action": "plan_save", "activity": "new", "days": "9",
                              "minutes": "10", "focus": "mix"}, follow_redirects=True)
    assert "Pick 2 to 6 days a week" in r.data.decode()
    assert data.get_plan(db.connect(path), uid) is None


def test_picking_a_side_on_home(web):
    w, path, uid = web
    conn = db.connect(path)
    earn(conn, uid, 700)
    c = signed_in(w, uid)
    assert "Pick your side" in c.get("/").data.decode()
    r = c.post("/side", data={"csrf": "x", "side": "strider"}, follow_redirects=True)
    page = r.data.decode()
    assert "The Strider&#39;s side" in page and "Lv 5 · Bystander" in page


def test_side_before_level_5_is_refused(web):
    w, path, uid = web
    r = signed_in(w, uid).post("/side", data={"csrf": "x", "side": "reaper"}, follow_redirects=True)
    assert "from level 5" in r.data.decode()
    assert data.level_info(db.connect(path), uid)["side"] is None


def test_finishing_a_challenge_can_level_you_up(web):
    w, path, uid = web
    conn = db.connect(path)
    earn(conn, uid, 95)                                   # 5 short of level 2
    c = signed_in(w, uid)
    c.post("/challenges", data={"csrf": "x", "action": "mini_start", "key": "pushups_10"})
    conn.execute("UPDATE mini_runs SET started_at = ? WHERE user_id = ?",
                 ((datetime.now(A.TZ) - timedelta(minutes=5)).isoformat(timespec="seconds"), uid))
    conn.commit()
    page = c.post("/challenges", data={"csrf": "x", "action": "mini_done"}, follow_redirects=True).data.decode()
    assert "Level up! You&#39;re level 2." in page


def test_leaderboard_rows_show_rank_badges(web):
    w, path, uid = web
    conn = db.connect(path)
    earn(conn, uid, 2700)
    data.set_side(conn, uid, "reaper")
    put_steps(conn, uid, A.today(), 4000)
    page = signed_in(w, uid).get("/leaderboard?period=all").data.decode()
    assert "rank-row" in page and "Lv 10 · Wisp" in page
