# DevOps Lens 🔍

**The "Heads-Up Display" for your infrastructure — see your Kubernetes context, AWS profile, Docker status, and Git branch at a glance.**

[![VS Code](https://img.shields.io/badge/VS%20Code-Extension-007ACC?style=for-the-badge&logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=tuanbulut.devops-lens)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

---

## 🚨 The Problem Every DevOps Engineer Knows

> *"Wait... am I connected to **production**?"*

You stop coding. Open a terminal. Type `kubectl config current-context`. Squint at the output. Breathe a sigh of relief (or panic). Go back to coding.

**Time lost: 15+ seconds** — and that cognitive interruption costs you even more.

Now multiply that by every time you wonder:
- "Which AWS account am I using?"
- "Is Docker even running?"
- "Did I forget to switch off `main`?"

---

## ✅ The Solution: A One-Second Safety Check

With **DevOps Lens**, you just **glance at the sidebar**.

🔴 **Red icon?** You're on production. Step carefully.  
🟢 **Green icon?** You're safe. Code freely.

**Time lost: 1 second.**

---

## 🚦 The Traffic Light System

DevOps Lens uses a simple, intuitive **traffic light** to protect you:

| Status | Meaning | When it appears |
|--------|---------|-----------------|
| 🟢 **Green** | Safe environment | `minikube`, `dev`, `staging`, `local`, etc. |
| 🔴 **Red** | ⚠️ PRODUCTION | Any context containing `prod`, `production`, `prd`, or `live` |

You'll know instantly if you're about to run that `kubectl delete` on the wrong cluster.

---

## 📊 The 4 Core Features

| Feature | What You See | Why It Matters |
|---------|--------------|----------------|
| ☸️ **Kubernetes Context** | Cluster name + safety indicator | Prevents accidental production deployments |
| ☁️ **AWS Profile** | Active credentials profile | Prevents deploying to wrong cloud account |
| 🐳 **Docker Status** | Running container count | Confirms your dev environment is up |
| 🌿 **Git Branch** | Current branch with warning | Prevents commits directly to `main` |

---

## 🎯 Who Is This For?

- **DevOps Engineers** juggling multiple clusters and cloud accounts
- **Backend Developers** who deploy from their local machine
- **Platform Engineers** managing production and staging environments
- **Anyone** who has ever had that "oh no" moment after running a command in the wrong context

---

## 📦 Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for **"DevOps Lens"**
4. Click **Install**

### From Source
```bash
git clone https://github.com/TuanBulut/devops-lens.git
cd devops-lens
npm install
npm run compile
```
Press `F5` to launch the Extension Development Host.

---

## 🔧 Usage

1. Look for the **DevOps Lens** icon in the Activity Bar (left sidebar)
2. Click it to open the **Infrastructure Status** panel
3. Statuses refresh automatically every **30 seconds**
4. Click the **↻ Refresh** button for instant updates

---

## 📋 Requirements

| Tool | Required? | Purpose |
|------|-----------|---------|
| `kubectl` | Optional | Kubernetes context detection |
| Docker Desktop | Optional | Container count |
| AWS CLI | Optional | Profile detection (uses env vars) |
| Git | Built-in | Uses VS Code's Git extension |

---

## 🛡️ Privacy & Security

- **100% Local** — No data leaves your machine
- **Read-Only** — DevOps Lens only *reads* status, never modifies anything
- **Open Source** — Audit the code yourself

---

## 📄 License

MIT © [Tuan Bulut](https://github.com/TuanBulut)

---

<p align="center">
  <strong>Stop guessing. Start glancing.</strong><br>
  <em>DevOps Lens — Infrastructure awareness in 1 second.</em>
</p>
