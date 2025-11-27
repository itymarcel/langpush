/**
 * Simple Popover Component
 */
class Popover {
  constructor(triggerElement, content, options = {}) {
    this.trigger = triggerElement;
    this.content = content;
    this.isOpen = false;
    this.options = {
      position: 'bottom',
      offset: 10,
      className: '',
      ...options
    };

    this.init();
  }

  init() {
    // Create popover element
    this.popover = document.createElement('div');
    this.popover.className = `popover ${this.options.className}`;
    this.popover.innerHTML = this.content;
    this.popover.style.display = 'none';

    // Add to DOM
    document.body.appendChild(this.popover);

    // Bind events
    this.trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (this.isOpen && !this.popover.contains(e.target)) {
        this.close();
      }
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    if (this.isOpen) return;

    this.isOpen = true;
    this.popover.style.display = 'block';
    this.position();

    // Add animation class
    setTimeout(() => {
      this.popover.classList.add('popover-open');
    }, 10);
  }

  close() {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.popover.classList.remove('popover-open');

    // Hide after animation
    setTimeout(() => {
      this.popover.style.display = 'none';
    }, 200);
  }

  position() {
    const triggerRect = this.trigger.getBoundingClientRect();
    const popoverRect = this.popover.getBoundingClientRect();
    const offset = this.options.offset;

    let top, left;

    switch (this.options.position) {
      case 'top':
        top = triggerRect.top - popoverRect.height - offset;
        left = triggerRect.left + (triggerRect.width / 2) - (popoverRect.width / 2);
        break;
      case 'bottom':
      default:
        top = triggerRect.bottom + offset;
        left = triggerRect.left + (triggerRect.width / 2) - (popoverRect.width / 2);
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height / 2) - (popoverRect.height / 2);
        left = triggerRect.left - popoverRect.width - offset;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height / 2) - (popoverRect.height / 2);
        left = triggerRect.right + offset;
        break;
    }

    // Keep popover within viewport
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    if (left < 10) left = 10;
    if (left + popoverRect.width > viewport.width - 10) {
      left = viewport.width - popoverRect.width - 10;
    }
    if (top < 10) top = 10;
    if (top + popoverRect.height > viewport.height - 10) {
      top = viewport.height - popoverRect.height - 10;
    }

    this.popover.style.position = 'fixed';
    this.popover.style.top = `${top}px`;
    this.popover.style.left = `${left}px`;
    this.popover.style.zIndex = '1000';
  }

  destroy() {
    if (this.popover && this.popover.parentNode) {
      this.popover.parentNode.removeChild(this.popover);
    }
  }
}