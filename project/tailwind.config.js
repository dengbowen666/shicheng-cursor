/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 宋韵雅致 · 设计色板
        paper: '#EFE5D2',      // 宣纸底
        mist: '#FAF4E6',       // 云雾白
        celadon: '#7F9B95',    // 汝窑天青（主色）
        celadonDeep: '#5F7F78',// 天青深
        mountain: '#B7C8C2',   // 远山青灰
        ochre: '#A9825C',      // 淡赭石（副色）
        ochreDeep: '#855F42',  // 赭石深
        ink: '#26231F',        // 墨色
        inkLight: '#665F53',   // 浅墨灰
        cinnabar: '#A64834',   // 朱砂（强调/印章）
        cinnabarDeep: '#843425',
        cyanq: '#7F9B95',      // 文档语义名：汝窑天青
        hill: '#B7C8C2',       // 文档语义名：远山青灰
        grayInk: '#665F53',    // 文档语义名：浅墨灰
      },
      fontFamily: {
        cn: ['"Noto Serif SC"', '"Songti SC"', 'SimSun', '"STSong"', 'serif'],
        brush: ['"Ma Shan Zheng"', '"STXingkai"', '"KaiTi"', '"STKaiti"', '"Noto Serif SC"', 'serif'],
        num: ['"Cormorant Garamond"', 'Georgia', '"Times New Roman"', 'serif'],
      },
      boxShadow: {
        paper: '0 2px 12px -4px rgba(44,42,38,0.18), 0 1px 3px rgba(44,42,38,0.08)',
        seal: '0 3px 8px -2px rgba(166,72,52,0.45)',
        drawer: '-8px 0 32px -12px rgba(44,42,38,0.28)',
      },
      letterSpacing: {
        song: '0.12em',
        wide2: '0.28em',
      },
      keyframes: {
        'seal-in': {
          '0%': { opacity: '0', transform: 'scale(1.4) rotate(-12deg)' },
          '60%': { opacity: '1', transform: 'scale(0.94) rotate(2deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(-4deg)' },
        },
        'ink-spread': {
          '0%': { opacity: '0', strokeDashoffset: '1000' },
          '100%': { opacity: '1', strokeDashoffset: '0' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'drawer-in': {
          '0%': { opacity: '0', transform: 'translateX(32px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'seal-in': 'seal-in 0.5s cubic-bezier(0.2,0.9,0.3,1.2) both',
        'ink-spread': 'ink-spread 1.6s ease-out both',
        'fade-up': 'fade-up 0.5s ease-out both',
        'drawer-in': 'drawer-in 0.35s ease-out both',
      },
    },
  },
  plugins: [],
}
