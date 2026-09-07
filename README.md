# DevOps Lens 🔍 *(v2.0)*

**The Ultimate Real-Time "Heads-Up Display" (HUD) for Your Infrastructure.**  
See your Kubernetes cluster, active namespace, AWS profile, Docker containers, Terraform workspace, and Git branch at a single glance — with zero lag and interactive controls.

[![VS Code](https://img.shields.io/badge/VS%20Code-Extension-007ACC?style=for-the-badge&logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=TughanbulutKurtulush.devops-lens)
[![Version](https://img.shields.io/badge/Version-2.0.0-blue?style=for-the-badge)](package.json)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

---

## ⚡ What's New in v2.0?

DevOps Lens v2.0 transforms from a passive 4-item list into a **full-featured, interactive, real-time DevOps command center**:

1. **⚡ True Real-Time Reactive Architecture (<100ms):**
   - File system watchers directly monitor `~/.kube/config`, `~/.aws/config`, `~/.aws/credentials`, and workspace `.env` files.
   - When you switch contexts in terminal using `kubectx` or `kubectl config use-context`, DevOps Lens updates **instantly** without waiting on a 30s timer!
   - Real-time hooks into VS Code's Git API for instant updates on branch checkout, staging, or committing.

2. **🛡️ Persistent Status Bar HUD:**
   - Always visible in VS Code's bottom status bar — no need to keep the sidebar open.
   - **High-Visibility Production Alert:** When connected to a production Kubernetes cluster or AWS account, the status bar turns **flashing RED** (`errorBackground`), giving you an unmissable safety warning before executing commands in your integrated terminal.

3. **🌲 Hierarchical Tree View with Drill-Down:**
   - **☸️ Kubernetes:** View cluster, server URL, active namespace, and expandable list of all available contexts.
   - **☁️ Cloud & AWS:** View active profile, region, account details, and all configured profiles from both `credentials` and `config`. Multi-cloud support for GCP projects and Azure subscriptions!
   - **🐳 Docker:** Live container count, plus an expandable list of running and stopped containers with image names, uptime, and mapped ports.
   - **🌿 Git:** Current branch, safety indicator, dirty working tree breakdown (staged, unstaged, untracked), ahead/behind commit sync, and latest commit hash/message.
   - **🌱 Terraform / OpenTofu:** Active workspace detection and switcher.

4. **🕹️ Interactive Switchers & Quick Controls:**
   - **One-Click Context Switcher:** Switch Kubernetes contexts from a searchable QuickPick palette.
   - **Namespace Switcher:** Select from active cluster namespaces or specify a custom namespace.
   - **AWS Profile Switcher:** Switch active profile with one click.
   - **Docker Actions:** Inline buttons to Start, Stop, Restart, View Logs, or launch an interactive shell (`exec sh`) directly in any container.
   - **DevOps Terminal Launcher:** Spawns an integrated terminal pre-configured with `AWS_PROFILE`, `AWS_REGION`, and your active cluster environment.

---

## 🚨 The Problem Every DevOps Engineer Knows

> *"Wait... am I connected to **production**?"*

You stop coding. Open a terminal. Type `kubectl config current-context`. Squint at the output. Breathe a sigh of relief (or panic). Go back to coding.

**Time lost: 15+ seconds** — and that cognitive interruption costs you even more.

Now multiply that by every time you wonder:
- *"Which AWS account / profile is active?"*
- *"What Kubernetes namespace am I targeting?"*
- *"Is the Redis / PostgreSQL container actually running?"*
- *"Did I accidentally push directly to `main`?"*

---

## 🚦 The Traffic Light System

DevOps Lens keeps you safe with automatic environment detection:

| Status | Meaning | When it appears |
|--------|---------|-----------------|
| 🟢 **Green / Normal** | Safe Environment | `minikube`, `dev`, `staging`, `local`, feature branches |
| 🔴 **High Alert Red** | ⚠️ **PRODUCTION DETECTED** | Contexts/profiles matching `prod`, `production`, `prd`, `live`, or `master-cluster` |

Whenever a production environment is active:
- The Status Bar HUD switches to a prominent **Red warning badge**.
- Terminal launch prompts confirm you really want to open a terminal against production.

---

## 📊 Feature Overview

| Component | Information Displayed | Interactive Actions |
|-----------|------------------------|---------------------|
| ☸️ **Kubernetes** | Current context, cluster, namespace, API server, prod badge | Switch context, switch namespace, browse all contexts |
| ☁️ **AWS & Cloud** | Active profile, region, account ID, GCP project, Azure subscription | Switch AWS profile, view all profiles |
| 🐳 **Docker** | Daemon status, container count, running vs stopped | Start, stop, restart, stream logs, container shell |
| 🌿 **Git** | Branch, protected branch warning, dirty status, ahead/behind sync | Real-time git event detection |
| 🌱 **Terraform** | Active workspace (`default`, `staging`, `prod`) | Switch workspace |
| 💻 **DevOps Terminal** | Pre-configured environment terminal | Launch terminal with active AWS & Kube credentials |

---

## ⚙️ Configuration Settings

Customize DevOps Lens in VS Code Settings (`Ctrl+,` -> Search for `DevOps Lens`):

| Setting | Default | Description |
|---------|---------|-------------|
| `devopsLens.refreshInterval` | `30` | Safety net polling interval in seconds (real-time watchers trigger instantly). |
| `devopsLens.productionKeywords` | `["prod", "production", "prd", "live", "main-cluster", "master-cluster"]` | Custom keywords that trigger production red alerts. |
| `devopsLens.statusBar.enabled` | `true` | Toggle the Status Bar HUD visibility. |
| `devopsLens.statusBar.showKubernetes` | `true` | Show/hide Kubernetes in Status Bar HUD. |
| `devopsLens.statusBar.showAws` | `true` | Show/hide AWS profile in Status Bar HUD. |
| `devopsLens.statusBar.showDocker` | `true` | Show/hide Docker count in Status Bar HUD. |
| `devopsLens.statusBar.showGit` | `true` | Show/hide Git branch in Status Bar HUD. |
| `devopsLens.enableTerraform` | `true` | Auto-detect Terraform / OpenTofu workspace. |
| `devopsLens.enableMultiCloud` | `true` | Auto-detect GCP active project & Azure subscription. |
| `devopsLens.warnOnProductionTerminal` | `true` | Confirmation prompt before opening terminal in prod. |

---

## ⌨️ Command Palette

All features can be triggered from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

- `DevOps Lens: Open Heads-Up Display (HUD)`
- `DevOps Lens: Switch Kubernetes Context`
- `DevOps Lens: Switch Kubernetes Namespace`
- `DevOps Lens: Switch AWS Profile`
- `DevOps Lens: Switch Terraform Workspace`
- `DevOps Lens: Open Terminal with Environment`
- `DevOps Lens: Start / Stop / Restart Container`
- `DevOps Lens: View Container Logs`
- `DevOps Lens: Exec Shell in Container`
- `DevOps Lens: Refresh Infrastructure Status`

---

## 🛡️ Privacy & Security

- **100% Local** — Zero telemetry. No credentials or data ever leave your computer.
- **Auditable** — Open source MIT license.

---

## 📄 License

MIT © [Tuan Bulut](https://github.com/TuanBulut)
