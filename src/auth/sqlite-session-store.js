import session from 'express-session';

export class SqliteSessionStore extends session.Store {
  constructor(database) {
    super();
    this.database = database;
    this.read = database.prepare('SELECT sess, expire FROM user_sessions WHERE sid = ?');
    this.write = database.prepare(`INSERT INTO user_sessions (sid, sess, expire)
      VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expire = excluded.expire`);
    this.remove = database.prepare('DELETE FROM user_sessions WHERE sid = ?');
    this.prune = database.prepare('DELETE FROM user_sessions WHERE expire <= ?');
  }

  get(sid, callback) {
    try {
      this.prune.run(Date.now());
      const row = this.read.get(sid);
      callback(null, row ? JSON.parse(row.sess) : null);
    } catch (error) { callback(error); }
  }

  set(sid, sess, callback = () => {}) {
    try {
      const expires = sess.cookie?.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + 86400000;
      this.write.run(sid, JSON.stringify(sess), expires);
      callback(null);
    } catch (error) { callback(error); }
  }

  touch(sid, sess, callback = () => {}) {
    try {
      const expires = sess.cookie?.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + 86400000;
      this.database.prepare('UPDATE user_sessions SET expire = ? WHERE sid = ?').run(expires, sid);
      callback(null);
    } catch (error) { callback(error); }
  }

  destroy(sid, callback = () => {}) {
    try { this.remove.run(sid); callback(null); } catch (error) { callback(error); }
  }
}
