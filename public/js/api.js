// API Helper
const API = {
  baseURL: '/api',
  getToken() { return localStorage.getItem('token'); },
  headers() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.getToken()}` };
  },
  async get(path) {
    const r = await fetch(this.baseURL + path, { headers: this.headers() });
    if (r.status === 401) { logout(); return; }
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(this.baseURL + path, { method: 'POST', headers: this.headers(), body: JSON.stringify(body) });
    return r.json();
  },
  async put(path, body) {
    const r = await fetch(this.baseURL + path, { method: 'PUT', headers: this.headers(), body: JSON.stringify(body) });
    return r.json();
  },
  async del(path) {
    const r = await fetch(this.baseURL + path, { method: 'DELETE', headers: this.headers() });
    return r.json();
  }
};
