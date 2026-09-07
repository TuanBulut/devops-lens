import * as vscode from 'vscode';
import { InfrastructureStatus } from './providers/types';

export class StatusBarHud implements vscode.Disposable {
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        const config = vscode.workspace.getConfiguration('devopsLens');
        const alignmentSetting = config.get<string>('statusBar.alignment', 'right');
        const alignment = alignmentSetting === 'left' ? vscode.StatusBarAlignment.Left : vscode.StatusBarAlignment.Right;

        this.statusBarItem = vscode.window.createStatusBarItem(
            alignment,
            120 // Placed nicely in the status bar
        );
        this.statusBarItem.command = 'devopsLens.openHud';
        this.statusBarItem.text = '$(dashboard) DevOps Lens';
        this.statusBarItem.tooltip = 'DevOps Lens HUD — Click to open menu';
        this.statusBarItem.show();
    }

    public update(status: InfrastructureStatus): void {
        const config = vscode.workspace.getConfiguration('devopsLens');
        const isEnabled = config.get<boolean>('statusBar.enabled', true);

        if (!isEnabled) {
            this.statusBarItem.hide();
            return;
        }

        const showK8s = config.get<boolean>('statusBar.showKubernetes', true);
        const showAws = config.get<boolean>('statusBar.showAws', true);
        const showDocker = config.get<boolean>('statusBar.showDocker', true);
        const showGit = config.get<boolean>('statusBar.showGit', true);

        const parts: string[] = [];

        // Kubernetes segment
        if (showK8s && status.kubernetes.context) {
            const k8sIcon = status.kubernetes.isProduction ? '$(error)' : '$(shield)';
            const ns = status.kubernetes.namespace ? `[${status.kubernetes.namespace}]` : '';
            // Shorten long GKE/EKS cluster prefixes for clean status bar readability
            let ctxDisplay = status.kubernetes.context;
            if (ctxDisplay.includes('_')) {
                const pieces = ctxDisplay.split('_');
                ctxDisplay = pieces[pieces.length - 1];
            } else if (ctxDisplay.includes('/')) {
                const pieces = ctxDisplay.split('/');
                ctxDisplay = pieces[pieces.length - 1];
            }
            parts.push(`${k8sIcon} ${ctxDisplay}${ns}`);
        }

        // Cloud segment (AWS, GCP, Azure)
        if (showAws) {
            if (status.aws.profile) {
                const awsIcon = status.aws.isProduction ? '$(alert)' : '$(cloud)';
                const regionStr = status.aws.region ? `@${status.aws.region}` : '';
                parts.push(`${awsIcon} aws:${status.aws.profile}${regionStr}`);
            } else if (status.cloud?.gcpProject) {
                parts.push(`$(cloud) gcp:${status.cloud.gcpProject}`);
            } else if (status.cloud?.azureSubscription) {
                parts.push(`$(azure) az:${status.cloud.azureSubscription}`);
            }
        }

        // Docker segment
        if (showDocker && status.docker.isRunning) {
            parts.push(`$(server) docker:${status.docker.runningCount}`);
        }

        // Git segment
        if (showGit && status.git.branch) {
            const gitIcon = status.git.isMainBranch ? '$(git-branch) [main]' : `$(git-branch) ${status.git.branch}`;
            const dirtyIcon = !status.git.isClean ? '*' : '';
            parts.push(`${gitIcon}${dirtyIcon}`);
        }

        if (parts.length === 0) {
            this.statusBarItem.text = '$(dashboard) DevOps Lens';
        } else {
            this.statusBarItem.text = parts.join(' | ');
        }

        // High-visibility visual alert if in production
        if (status.hasProductionAlert) {
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.errorForeground');
        } else {
            this.statusBarItem.backgroundColor = undefined;
            this.statusBarItem.color = undefined;
        }

        // Build rich markdown tooltip
        const md = new vscode.MarkdownString();
        md.isTrusted = true;

        if (status.hasProductionAlert) {
            md.appendMarkdown('### ⚠️ PRODUCTION ENVIRONMENT ACTIVE\n\n');
            md.appendMarkdown(`**Caution:** Connected to production context (${status.productionReason || 'Production keywords detected'}). Double-check all terminal and deployment commands!\n\n---\n\n`);
        } else {
            md.appendMarkdown('### 🛡️ DevOps Infrastructure HUD (Safe)\n\n---\n\n');
        }

        md.appendMarkdown('| Component | Status | Details |\n');
        md.appendMarkdown('|---|---|---|\n');

        const k8sText = status.kubernetes.context
            ? `**${status.kubernetes.context}** (ns: \`${status.kubernetes.namespace || 'default'}\`)`
            : '*Not configured*';
        md.appendMarkdown(`| ☸️ **Kubernetes** | ${status.kubernetes.isProduction ? '🔴 **PROD**' : '🟢 Safe'} | ${k8sText} |\n`);

        const awsText = status.aws.profile
            ? `**${status.aws.profile}** ${status.aws.region ? `(\`${status.aws.region}\`)` : ''}`
            : '*Not set*';
        md.appendMarkdown(`| ☁️ **AWS** | ${status.aws.isProduction ? '🔴 **PROD**' : '⚪ Active'} | ${awsText} |\n`);

        const dockerText = status.docker.isRunning
            ? `${status.docker.runningCount} running, ${status.docker.stoppedCount} stopped`
            : '*Daemon not running*';
        md.appendMarkdown(`| 🐳 **Docker** | ${status.docker.isRunning ? '🟢 Running' : '⚠️ Stopped'} | ${dockerText} |\n`);

        if (status.git.branch) {
            const syncText = `Ahead: ${status.git.ahead}, Behind: ${status.git.behind}`;
            md.appendMarkdown(`| 🌿 **Git** | ${status.git.isMainBranch ? '⚠️ Protected' : '🟢 Feature'} | \`${status.git.branch}\` (${status.git.isClean ? 'Clean' : 'Dirty'}, ${syncText}) |\n`);
        }

        if (status.terraform?.detected) {
            md.appendMarkdown(`| 🌱 **Terraform** | 🟢 Detected | Workspace: \`${status.terraform.workspace || 'default'}\` |\n`);
        }

        md.appendMarkdown('\n---\n');
        md.appendMarkdown('[Open Interactive HUD](command:devopsLens.openHud) &nbsp;|&nbsp; [Refresh](command:devopsLens.refresh) &nbsp;|&nbsp; [Launch Terminal](command:devopsLens.openTerminal)\n');

        this.statusBarItem.tooltip = md;
        this.statusBarItem.show();
    }

    public dispose(): void {
        this.statusBarItem.dispose();
    }
}
