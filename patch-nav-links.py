import re
from pathlib import Path

dir = Path(__file__).parent

OLD_CSS = '''    .nav-links > li > a,
    .nav-dropdown-trigger {
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--text-secondary);
      transition: color var(--transition);
    }

    .nav-links > li > a:hover,
    .nav-dropdown-trigger:hover,
    .nav-dropdown-trigger.active {
      color: var(--text-primary);
    }

    .nav-dropdown-trigger {
      background: none;
      border: none;
      font-family: inherit;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 0;
      position: relative;
    }

    .nav-dropdown-trigger.active::after {
      content: '';
      position: absolute;
      bottom: -8px;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--accent);
      border-radius: 2px;
    }'''

NEW_CSS = '''    .nav-links > li > a,
    .nav-hub-link {
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--text-secondary);
      transition: color var(--transition);
    }

    .nav-links > li > a:hover,
    .nav-hub-link:hover,
    .nav-hub-link.active {
      color: var(--text-primary);
    }

    .nav-dropdown-trigger {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .nav-hub-link {
      position: relative;
    }

    .nav-hub-link.active::after {
      content: '';
      position: absolute;
      bottom: -8px;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--accent);
      border-radius: 2px;
    }

    .nav-dropdown-toggle {
      background: none;
      border: none;
      font-family: inherit;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      padding: 2px 0;
      color: var(--text-secondary);
      line-height: 1;
    }

    .nav-dropdown-toggle:hover {
      color: var(--text-primary);
    }'''

OLD_MOBILE = '''      .nav-links > li > a,
      .nav-dropdown-trigger {
        display: flex;
        width: 100%;
        padding: 14px 0;
        font-size: 1rem;
        justify-content: space-between;
      }

      .nav-dropdown-trigger.active::after { display: none; }'''

NEW_MOBILE = '''      .nav-links > li > a {
        display: flex;
        width: 100%;
        padding: 14px 0;
        font-size: 1rem;
      }

      .nav-dropdown-trigger {
        display: flex;
        width: 100%;
        padding: 14px 0;
        font-size: 1rem;
        justify-content: space-between;
        align-items: center;
      }

      .nav-hub-link.active::after { display: none; }'''

OLD_JS = '''      dropdownItems.forEach((item) => {
        const trigger = item.querySelector('.nav-dropdown-trigger');
        if (!trigger) return;
        let closeTimer = null;

        const openDropdown = () => {
          if (window.innerWidth <= 900) return;
          clearTimeout(closeTimer);
          dropdownItems.forEach((i) => {
            if (i !== item) {
              i.classList.remove('open');
              const t = i.querySelector('.nav-dropdown-trigger');
              if (t) t.setAttribute('aria-expanded', 'false');
            }
          });
          item.classList.add('open');
          trigger.setAttribute('aria-expanded', 'true');
        };

        const scheduleClose = () => {
          if (window.innerWidth <= 900) return;
          clearTimeout(closeTimer);
          closeTimer = setTimeout(() => {
            item.classList.remove('open');
            trigger.setAttribute('aria-expanded', 'false');
          }, 200);
        };

        trigger.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          clearTimeout(closeTimer);
          const isOpen = item.classList.contains('open');
          dropdownItems.forEach((i) => i.classList.remove('open'));
          if (!isOpen) item.classList.add('open');
          trigger.setAttribute('aria-expanded', String(!isOpen));
        });

        item.addEventListener('mouseenter', openDropdown);
        item.addEventListener('mouseleave', scheduleClose);
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-item.has-dropdown')) {
          dropdownItems.forEach((i) => {
            i.classList.remove('open');
            const t = i.querySelector('.nav-dropdown-trigger');
            if (t) t.setAttribute('aria-expanded', 'false');
          });
        }
      });'''

NEW_JS = '''      dropdownItems.forEach((item) => {
        const toggle = item.querySelector('.nav-dropdown-toggle');
        if (!toggle) return;
        let closeTimer = null;

        const openDropdown = () => {
          if (window.innerWidth <= 900) return;
          clearTimeout(closeTimer);
          dropdownItems.forEach((i) => {
            if (i !== item) {
              i.classList.remove('open');
              const t = i.querySelector('.nav-dropdown-toggle');
              if (t) t.setAttribute('aria-expanded', 'false');
            }
          });
          item.classList.add('open');
          toggle.setAttribute('aria-expanded', 'true');
        };

        const scheduleClose = () => {
          if (window.innerWidth <= 900) return;
          clearTimeout(closeTimer);
          closeTimer = setTimeout(() => {
            item.classList.remove('open');
            toggle.setAttribute('aria-expanded', 'false');
          }, 200);
        };

        toggle.addEventListener('click', (e) => {
          if (window.innerWidth > 900) return;
          e.preventDefault();
          e.stopPropagation();
          clearTimeout(closeTimer);
          const isOpen = item.classList.contains('open');
          dropdownItems.forEach((i) => i.classList.remove('open'));
          if (!isOpen) item.classList.add('open');
          toggle.setAttribute('aria-expanded', String(!isOpen));
        });

        item.addEventListener('mouseenter', openDropdown);
        item.addEventListener('mouseleave', scheduleClose);
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-item.has-dropdown')) {
          dropdownItems.forEach((i) => {
            i.classList.remove('open');
            const t = i.querySelector('.nav-dropdown-toggle');
            if (t) t.setAttribute('aria-expanded', 'false');
          });
        }
      });'''

SPORTS = [
    ('NBA', 'nba.html', 'nba'),
    ('WNBA', 'wnba.html', 'wnba'),
    ('NFL', 'nfl.html', 'nfl'),
    ('Soccer', 'soccer.html', 'soccer'),
    ('MLB', 'mlb.html', 'mlb'),
]

def hub_link(label, href, active_sport, sport_key):
    active = ' active' if active_sport == sport_key else ''
    return f'''          <div class="nav-dropdown-trigger">
            <a href="{href}" class="nav-hub-link{active}">{label}</a>
            <button type="button" class="nav-dropdown-toggle" aria-expanded="false" aria-label="Toggle {label} menu"><span class="nav-chevron">▾</span></button>
          </div>'''

def replace_dropdown_buttons(html, active_sport):
    for label, href, key in SPORTS:
        old = f'<button class="nav-dropdown-trigger{(" active" if active_sport == key else "")}" aria-expanded="false">{label} <span class="nav-chevron">▾</span></button>'
        old_plain = f'<button class="nav-dropdown-trigger" aria-expanded="false">{label} <span class="nav-chevron">▾</span></button>'
        new = hub_link(label, href, active_sport, key)
        html = html.replace(old, new)
        html = html.replace(old_plain, new)
    return html

files = {
    'index.html': None,
    'nba.html': 'nba',
    'wnba.html': 'wnba',
    'nfl.html': 'nfl',
    'ufc.html': None,
    'boxing.html': None,
    'soccer.html': 'soccer',
    'mlb.html': 'mlb',
}

for filename, active in files.items():
    path = dir / filename
    html = path.read_text(encoding='utf-8')
    html = html.replace(OLD_CSS, NEW_CSS)
    html = html.replace(OLD_MOBILE, NEW_MOBILE)
    html = html.replace(OLD_JS, NEW_JS)
    html = replace_dropdown_buttons(html, active)
    path.write_text(html, encoding='utf-8')
    print('Patched', filename)

path.unlink()
