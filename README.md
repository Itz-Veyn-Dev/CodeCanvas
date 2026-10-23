# 🎨 CodeCanvas

### A creative workspace for notes, code, and ideas.

CodeCanvas is an experimental desktop application built with Electron and JavaScript. It aims to bring note-taking, code snippets, and a flexible canvas into one focused workspace.

> **Status:** 🚧 Under active development

---

## ✨ Vision

Ideas rarely fit into a simple text document.

CodeCanvas explores a different approach: a workspace where developers can organize thoughts, write notes, keep code snippets, and develop ideas in a more flexible environment.

The goal is to make it easier to move from **thinking → organizing → building** without losing context.

## 🚀 Features

- 📝 **Notes:** Create and organize notes in a desktop workspace.
- 💻 **Code Blocks:** Keep code snippets alongside your ideas.
- 🧩 **Free Canvas:** Work toward a flexible layout for arranging different content blocks.
- 🎨 **Visual Organization:** Separate and structure information in a way that suits your workflow.
- 💾 **Local Data:** Designed around storing workspace data locally.
- 🖥️ **Desktop Experience:** Built with Electron for desktop use.

*CodeCanvas is a work in progress. Feature availability and reliability may vary between versions.*

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| JavaScript | Application logic |
| Electron | Desktop application |
| HTML & CSS | User interface |
| Node.js | Runtime and tooling |
| npm | Dependency management |

## 📦 Getting Started

### Prerequisites

Install the following before running the project:

- [Node.js](https://nodejs.org/)
- npm, included with Node.js
- Git (optional, for cloning the repository)

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/YOUR-USERNAME/CodeCanvas.git
```

**2. Enter the project directory**

```bash
cd CodeCanvas
```

**3. Install dependencies**

```bash
npm install
```

**4. Start CodeCanvas**

```bash
npm start
```

> If Electron fails to install, check your npm script permissions and the Electron installation instructions before changing dependency versions.

## 📁 Project Structure

```text
CodeCanvas/
├── src/
│   ├── renderer/
│   │   └── app.js
│   ├── styles/
│   │   └── main.css
│   └── index.html
├── main.js
├── preload.js
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

*The structure above reflects the expected layout; adjust it if your current project differs.*

## 🗺️ Roadmap

- [ ] Improve free-canvas interactions
- [ ] Make resizing and positioning reliable across content blocks
- [ ] Improve code-block editing
- [ ] Strengthen local saving and recovery
- [ ] Refine fullscreen behavior
- [ ] Improve the overall user experience
- [ ] Add screenshots and a release build

## 🤝 Contributing

CodeCanvas is an experimental project, and feedback is welcome.

1. Fork the repository.
2. Create a branch for your change.
3. Make your changes and test them.
4. Open a pull request describing what you improved.

For bugs, include reproduction steps and relevant error messages.

## 🔐 Security & Privacy

- Never commit passwords, API keys, tokens, or private data.
- Keep generated dependencies such as `node_modules` out of version control.
- Review Electron security settings before distributing production builds.

## 📄 License

No license has been selected yet. Until a license is added, do not assume that others have permission to redistribute or modify the project.

---

## 🇮🇷 توضیحات فارسی

**CodeCanvas** یک اپلیکیشن دسکتاپ آزمایشی است که با Electron و JavaScript ساخته شده و هدفش ترکیب یادداشت‌برداری، نگهداری قطعه‌کدها و سازمان‌دهی ایده‌ها در یک فضای کاری انعطاف‌پذیر است.

### امکانات و اهداف پروژه

- 📝 ساخت و مدیریت یادداشت‌ها
- 💻 نگهداری کدها در کنار توضیحات
- 🎨 ایجاد یک فضای کاری آزاد برای مرتب‌کردن محتوا
- 💾 تمرکز بر ذخیره‌سازی محلی اطلاعات
- 🖥️ اجرا به‌عنوان برنامهٔ دسکتاپ

این پروژه هنوز در حال توسعه است؛ بنابراین ممکن است بعضی قابلیت‌ها کامل نباشند یا به اصلاح نیاز داشته باشند.

### نصب و اجرا

ابتدا Node.js را نصب کن و سپس در ترمینال پوشهٔ پروژه اجرا کن:

```bash
npm install
npm start
```

### مشارکت در پروژه

اگر ایده‌ای برای بهبود CodeCanvas داری یا باگی پیدا کردی، می‌توانی با ثبت Issue یا ارسال Pull Request در توسعهٔ آن مشارکت کنی.

**ساخته‌شده با کنجکاوی، کدنویسی و تلاش برای ساختن یک فضای کاری بهتر.** 🚀
