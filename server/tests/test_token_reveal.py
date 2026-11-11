"""The phone token on the Settings page is shown only after the right PIN."""
import pytest

import app as A
import data
import db


@pytest.fixture
def web(tmp_path):
    A.FAILED_LOGINS.clear()
    A.FAILED_BY_ADDRESS.clear()
    w = A.create_app()
    path = str(tmp_path / "tokens.sqlite3")
    w.config.update(TESTING=True, DATABASE=path)
    conn = db.connect(path)
    db.create_tables(conn)
    uid = data.create_user(conn, "sam", "Sam Lee", "student", "Grade 9A", "teen_13_17", "1234")
    token = data.get_user(conn, uid)["api_token"]
    conn.close()
    return w, uid, token


def signed_in(w, uid):
    c = w.test_client()
    with c.session_transaction() as s:
        s["user_id"] = uid
        s["csrf"] = "x"
    return c


def test_token_is_not_in_the_settings_page_by_default(web):
    w, uid, token = web
    page = signed_in(w, uid).get("/settings").data.decode()
    assert token not in page
    assert 'name="action" value="reveal_token"' in page


def test_wrong_pin_does_not_show_the_token(web):
    w, uid, token = web
    c = signed_in(w, uid)
    c.post("/settings", data={"csrf": "x", "action": "reveal_token", "pin": "0000"})
    page = c.get("/settings").data.decode()
    assert token not in page
    assert "isn&#39;t right" in page


def test_right_pin_shows_the_token_then_hide_removes_it(web):
    w, uid, token = web
    c = signed_in(w, uid)
    c.post("/settings", data={"csrf": "x", "action": "reveal_token", "pin": "1234"})
    assert token in c.get("/settings").data.decode()
    c.post("/settings", data={"csrf": "x", "action": "hide_token"})
    assert token not in c.get("/settings").data.decode()


def test_shown_token_expires_after_the_time_limit(web):
    w, uid, token = web
    c = signed_in(w, uid)
    c.post("/settings", data={"csrf": "x", "action": "reveal_token", "pin": "1234"})
    with c.session_transaction() as s:
        s["token_shown_until"] = 0          # as if the 5 minutes had passed
    assert token not in c.get("/settings").data.decode()


def test_wrong_pins_lock_out_even_the_right_one(web):
    w, uid, token = web
    c = signed_in(w, uid)
    for _ in range(A.LOGIN_TRIES):
        c.post("/settings", data={"csrf": "x", "action": "reveal_token", "pin": "0000"})
    c.post("/settings", data={"csrf": "x", "action": "reveal_token", "pin": "1234"})
    page = c.get("/settings").data.decode()
    assert token not in page
    assert "Too many wrong PINs" in page
