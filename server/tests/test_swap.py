"""Pages that save without reloading are marked <body data-swap>; the rest keep ordinary page loads."""
import pytest

import app as A
import config
import data
import db


@pytest.fixture
def web(tmp_path):
    w = A.create_app()
    path = str(tmp_path / "swap.sqlite3")
    w.config.update(TESTING=True, DATABASE=path)
    conn = db.connect(path)
    db.create_tables(conn)
    uid = data.create_user(conn, "sam", "Sam Lee", "student", "Grade 9A", "teen_13_17", "1234")
    owner = data.create_user(conn, config.OWNER_USERNAME, "Owner", "admin", None, "adult_18_39", "1234")
    conn.close()
    return w, uid, owner


def signed_in(w, uid):
    c = w.test_client()
    with c.session_transaction() as s:
        s["user_id"] = uid
        s["csrf"] = "x"
    return c


def body_tag(html):
    start = html.index("<body")
    return html[start:html.index(">", start)]


@pytest.mark.parametrize("path", ["/", "/log", "/challenges", "/settings", "/leaderboard", "/badges"])
def test_everyday_pages_save_without_reloading(web, path):
    w, uid, _ = web
    page = signed_in(w, uid).get(path).data.decode()
    assert "data-swap" in body_tag(page)


def test_login_page_keeps_normal_loads(web):
    w, _, _ = web
    assert "data-swap" not in body_tag(w.test_client().get("/login").data.decode())


def test_admin_keeps_normal_loads(web):
    w, _, owner = web
    page = signed_in(w, owner).get("/admin").data.decode()
    assert "data-swap" not in body_tag(page)


def test_theme_and_fast_mode_reload_the_whole_page(web):
    """They change the page's look (<html> classes, colours), which a <main> swap can't."""
    w, uid, _ = web
    page = signed_in(w, uid).get("/settings").data.decode()
    for action in ('value="theme"', 'value="fast"'):
        form_start = page.rindex("<form", 0, page.index(action))
        assert "data-reload" in page[form_start:page.index(">", form_start)]


def test_app_js_has_the_swap_code_and_a_new_version(web):
    w, uid, _ = web
    page = signed_in(w, uid).get("/").data.decode()
    assert f"js/app.js?v={A.ASSET_VERSION}" in page
    js = w.test_client().get("/static/js/app.js").data.decode()
    assert "Save without reloading" in js and "StrideBoard.setup(document, true)" in js
