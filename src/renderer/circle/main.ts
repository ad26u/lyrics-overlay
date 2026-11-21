import type { OverlayState } from '../../shared/types.ts';

const body = document.body;
const disc = document.getElementById('disc')!;
const list = document.getElementById('list')!;
const cover = document.getElementById('cover') as HTMLImageElement;
const wrap = document.getElementById('wrap')!;

let hover = false;
let closeTimer = 0;

function setOpen(open: boolean) {
  if (open) {
    clearTimeout(closeTimer);
    body.classList.add('open');
  } else {
    closeTimer = window.setTimeout(() => body.classList.remove('open'), 300);
  }
}

function setHover(on: boolean) {
  if (on === hover) return;
  hover = on;
  window.overlay.setHover(on); // main stops/starts click-through
  setOpen(on);
}

// While click-through, the window still gets forwarded mousemove events.
document.addEventListener('mousemove', (e) => {
  const inDisc = disc.getBoundingClientRect();
  const inList = body.classList.contains('open') ? list.getBoundingClientRect() : null;
  const inside = (r: DOMRect | null) => !!r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  setHover(inside(inDisc) || inside(inList));
});
document.addEventListener('mouseleave', () => setHover(false));

function item(title: string, artist: string, img: string | undefined, now: boolean): HTMLLIElement {
  const li = document.createElement('li');
  if (now) li.className = 'now';
  const im = document.createElement('img');
  if (img) im.src = img;
  const txt = document.createElement('div');
  txt.className = 'txt';
  const t = document.createElement('div');
  t.className = 't';
  t.textContent = title;
  const a = document.createElement('div');
  a.className = 'a';
  a.textContent = artist;
  txt.append(t, a);
  li.append(im, txt);
  return li;
}

window.overlay.onState((s: OverlayState) => {
  const np = s.nowPlaying;
  body.classList.toggle('playing', !!np?.playing);
  if (!np) return;
  const img = np.coverDataUrl ?? np.coverUrl;
  if (img && cover.src !== img) cover.src = img;
  const rows = [item(np.title, np.artist, img, true)];
  if (s.queue.length) {
    const label = document.createElement('li');
    label.className = 'label';
    label.textContent = 'التالي';
    rows.push(label);
    for (const q of s.queue.slice(0, 4)) rows.push(item(q.title, q.artist, q.coverUrl, false));
  }
  list.replaceChildren(...rows);
});

window.overlay.onSide((side) => {
  body.classList.toggle('left', side === 'left');
  body.classList.toggle('right', side === 'right');
});

void wrap;
