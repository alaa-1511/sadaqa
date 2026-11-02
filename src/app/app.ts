import { Component, signal, computed, OnInit } from '@angular/core';

interface DhikrItem {
  id: string;
  text: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  // Dhikr Collection (Exact 7 Adhkar)
  readonly dhikrItems: DhikrItem[] = [
    { id: 'subhanallah', text: 'سُبْحَانَ اللَّهِ' },
    { id: 'alhamdulillah', text: 'الْحَمْدُ لِلَّهِ' },
    { id: 'la_ilaha_illallah', text: 'لَا إِلَٰهَ إِلَّا اللَّهُ' },
    { id: 'allahu_akbar', text: 'اللَّهُ أَكْبَرُ' },
    { id: 'astaghfirullah', text: 'أَسْتَغْفِرُ اللَّهَ' },
    { id: 'salawat', text: 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ' },
    { id: 'subhan_wa_bihamdihi', text: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ' }
  ];

  // State Signals
  activeDhikrIndex = signal<number>(0);
  dhikrCounts = signal<Record<string, number>>({});
  grandTotal = signal<number>(0);

  isSoundEnabled = signal<boolean>(true);
  isDarkTheme = signal<boolean>(true);

  isPressed = signal<boolean>(false);
  isPopNumber = signal<boolean>(false);

  toastMessage = signal<string>('');
  isToastVisible = signal<boolean>(false);
  private toastTimer: any = null;

  // Interactivity for Duas & Adhkar
  duaHearted = signal<boolean[]>([false, false, false, false]);
  adhkarCounts = signal<number[]>([0, 0, 0, 0, 0]);

  // Audio Context
  private audioCtx: AudioContext | null = null;

  // Computed Values
  currentDhikrText = computed(() => {
    const idx = this.activeDhikrIndex();
    return this.dhikrItems[idx]?.text || '';
  });

  currentDhikrCount = computed(() => {
    const idx = this.activeDhikrIndex();
    const id = this.dhikrItems[idx]?.id;
    return this.dhikrCounts()[id] || 0;
  });

  ngOnInit() {
    this.loadState();
    this.applyTheme(this.isDarkTheme());
  }

  // Convert digits to Arabic-Indic (0 -> ٠, 1 -> ١, ...)
  toArabic(n: number | string | null | undefined): string {
    if (n === null || n === undefined) return '٠';
    const arDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return String(n).replace(/[0-9]/g, d => arDigits[+d]);
  }

  // Handle Big "سبّح" Tap
  increment(event?: MouseEvent) {
    const idx = this.activeDhikrIndex();
    const item = this.dhikrItems[idx];
    const prevCounts = this.dhikrCounts();
    const newCount = (prevCounts[item.id] || 0) + 1;
    const newTotal = this.grandTotal() + 1;

    // Update signals
    this.dhikrCounts.set({
      ...prevCounts,
      [item.id]: newCount
    });
    this.grandTotal.set(newTotal);

    // Persist
    this.saveState();

    // Feedback
    this.vibrate(22);
    this.playAudioClick();

    // Button animation feedback
    this.isPressed.set(true);
    setTimeout(() => this.isPressed.set(false), 120);

    this.isPopNumber.set(true);
    setTimeout(() => this.isPopNumber.set(false), 120);

    // Visual ripple effect
    if (event) {
      this.createRipple(event);
    }
  }

  // Switch Selected Dhikr
  selectDhikr(idx: number) {
    this.activeDhikrIndex.set(idx);
    this.saveState();
    this.vibrate(15);
  }

  // Reset Current Dhikr Counter
  resetCurrent() {
    const idx = this.activeDhikrIndex();
    const item = this.dhikrItems[idx];
    const current = this.dhikrCounts()[item.id] || 0;
    if (current === 0) return;

    const ok = window.confirm(`هل تريد تصفير عداد (${item.text})؟`);
    if (ok) {
      const prevCounts = this.dhikrCounts();
      this.dhikrCounts.set({
        ...prevCounts,
        [item.id]: 0
      });
      this.saveState();
      this.vibrate(30);
    }
  }

  // Audio click synthesizer
  toggleSound() {
    const next = !this.isSoundEnabled();
    this.isSoundEnabled.set(next);
    try {
      localStorage.setItem('sadaqa_sound', JSON.stringify(next));
    } catch (e) {}
    if (next) this.playAudioClick();
  }

  private playAudioClick() {
    if (!this.isSoundEnabled()) return;
    try {
      if (!this.audioCtx && (window.AudioContext || (window as any).webkitAudioContext)) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      if (!this.audioCtx) return;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(560, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(130, this.audioCtx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.22, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.045);
    } catch (e) {}
  }

  // Haptic feedback
  private vibrate(ms = 20) {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch (e) {}
    }
  }

  // Ripple visual effect inside tap button
  private createRipple(event: MouseEvent) {
    const btn = event.currentTarget as HTMLElement;
    if (!btn) return;

    const circle = document.createElement('span');
    circle.className = 'ripple';

    const rect = btn.getBoundingClientRect();
    const diameter = Math.max(rect.width, rect.height);
    const radius = diameter / 2;

    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - rect.left - radius}px`;
    circle.style.top = `${event.clientY - rect.top - radius}px`;

    const old = btn.querySelector('.ripple');
    if (old) old.remove();

    btn.appendChild(circle);
    setTimeout(() => circle.remove(), 500);
  }

  // Theme Toggle
  toggleTheme() {
    const next = !this.isDarkTheme();
    this.isDarkTheme.set(next);
    this.applyTheme(next);
    try {
      localStorage.setItem('sadaqa_theme', next ? 'dark' : 'light');
    } catch (e) {}
  }

  private applyTheme(isDark: boolean) {
    const root = document.documentElement;
    if (isDark) {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', 'light');
    }
  }

  // Share functionality
  async share() {
    const shareData = {
      title: 'صدقة جارية على روح يوسف إبراهيم محمد البحراوي',
      text: 'صدقة جارية على روح الوالد يوسف إبراهيم محمد البحراوي رحمه الله وغفر له. سبحة إلكترونية وأدعية وأذكار، شاركونا الأجر عبر الرابط:',
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          this.copyToClipboard(`${shareData.text}\n${shareData.url}`);
        }
      }
    } else {
      this.copyToClipboard(`${shareData.text}\n${shareData.url}`);
    }
  }

  private copyToClipboard(text: string) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.triggerToast('تم نسخ الرابط ورسالة الدعاء بنجاح، جزاكم الله خيراً');
      }).catch(() => this.fallbackCopy(text));
    } else {
      this.fallbackCopy(text);
    }
  }

  private fallbackCopy(text: string) {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.top = '-9999px';
    document.body.appendChild(area);
    area.focus();
    area.select();
    try {
      document.execCommand('copy');
      this.triggerToast('تم نسخ الرابط ورسالة الدعاء بنجاح، جزاكم الله خيراً');
    } catch (e) {
      this.triggerToast('يرجى نسخ الرابط من شريط المتصفح');
    }
    document.body.removeChild(area);
  }

  private triggerToast(msg: string) {
    this.toastMessage.set(msg);
    this.isToastVisible.set(true);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.isToastVisible.set(false), 3500);
  }

  // Dua "آمين" Button Toggle
  toggleAmin(index: number) {
    this.vibrate(20);
    const curr = [...this.duaHearted()];
    curr[index] = !curr[index];
    this.duaHearted.set(curr);
  }

  // Adhkar Step Progression
  advanceAdhkar(index: number, maxVal: number) {
    this.vibrate(20);
    this.playAudioClick();

    const curr = [...this.adhkarCounts()];
    if (curr[index] < maxVal) {
      curr[index] = curr[index] + 1;
      this.adhkarCounts.set(curr);
    }
  }

  getAdhkarPercent(index: number, maxVal: number): number {
    const count = this.adhkarCounts()[index] || 0;
    return Math.min(100, (count / maxVal) * 100);
  }

  // LocalStorage Persistence
  private loadState() {
    try {
      const savedCounts = localStorage.getItem('sadaqa_counts');
      if (savedCounts) this.dhikrCounts.set(JSON.parse(savedCounts));

      const savedTotal = localStorage.getItem('sadaqa_total');
      if (savedTotal) this.grandTotal.set(JSON.parse(savedTotal));

      const savedIdx = localStorage.getItem('sadaqa_idx');
      if (savedIdx !== null) this.activeDhikrIndex.set(Number(savedIdx));

      const savedSound = localStorage.getItem('sadaqa_sound');
      if (savedSound !== null) this.isSoundEnabled.set(JSON.parse(savedSound));

      const savedTheme = localStorage.getItem('sadaqa_theme');
      if (savedTheme !== null) this.isDarkTheme.set(savedTheme === 'dark');
    } catch (e) {}
  }

  private saveState() {
    try {
      localStorage.setItem('sadaqa_counts', JSON.stringify(this.dhikrCounts()));
      localStorage.setItem('sadaqa_total', JSON.stringify(this.grandTotal()));
      localStorage.setItem('sadaqa_idx', String(this.activeDhikrIndex()));
    } catch (e) {}
  }
}
