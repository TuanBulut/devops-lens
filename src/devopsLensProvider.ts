import * as vscode from 'vscode';
import { getKubernetesStatus } from './providers/kubernetesProvider';
import { getAwsStatus } from './providers/awsProvider';
import { getDockerStatus } from './providers/dockerProvider';
import { getGitStatus } from './providers/gitProvider';

export class DevOpsLensProvider implements vscode.TreeDataProvider<StatusItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<StatusItem | undefined | null | void> = new vscode.EventEmitter<StatusItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<StatusItem | undefined | null | void> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: StatusItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: StatusItem): Promise<StatusItem[]> {
        if (element) {
            return []; // No nested items
        }

        // Fetch all statuses in parallel
        const [k8sStatus, awsStatus, dockerStatus, gitStatus] = await Promise.all([
            getKubernetesStatus(),
            getAwsStatus(),
            getDockerStatus(),
            getGitStatus()
        ]);

        const items: StatusItem[] = [];

        // Kubernetes Context
        items.push(new StatusItem(
            `☸️ Kubernetes`,
            k8sStatus.context || 'Not configured',
            k8sStatus.isProduction ? 'danger' : 'safe',
            k8sStatus.isProduction
                ? '⚠️ PRODUCTION ENVIRONMENT - Be careful!'
                : 'Safe environment',
            'kubernetes'
        ));

        // AWS Profile
        items.push(new StatusItem(
            `☁️ AWS Profile`,
            awsStatus.profile || 'Not set',
            'neutral',
            awsStatus.profile ? `Using profile: ${awsStatus.profile}` : 'No AWS profile configured',
            'aws'
        ));

        // Docker Status
        items.push(new StatusItem(
            `🐳 Docker`,
            dockerStatus.isRunning
                ? `${dockerStatus.containerCount} Container${dockerStatus.containerCount !== 1 ? 's' : ''} Running`
                : 'Not Running',
            dockerStatus.isRunning ? 'safe' : 'warning',
            dockerStatus.isRunning
                ? `Docker daemon is running with ${dockerStatus.containerCount} active container(s)`
                : 'Docker daemon is not running',
            'docker'
        ));

        // Git Branch
        items.push(new StatusItem(
            `🌿 Git Branch`,
            gitStatus.branch || 'No repo',
            gitStatus.isMainBranch ? 'warning' : 'safe',
            gitStatus.isMainBranch
                ? '⚠️ On main branch - consider creating a feature branch'
                : gitStatus.branch
                    ? `Working on branch: ${gitStatus.branch}`
                    : 'No Git repository detected',
            'git'
        ));

        return items;
    }
}

class StatusItem extends vscode.TreeItem {
    constructor(
        public readonly category: string,
        public readonly status: string,
        public readonly statusType: 'safe' | 'danger' | 'warning' | 'neutral',
        public readonly tooltipText: string,
        public readonly itemType: string
    ) {
        super(`${category}: ${status}`, vscode.TreeItemCollapsibleState.None);

        this.tooltip = tooltipText;
        this.description = '';

        // Set icon based on status type
        this.iconPath = this.getIcon();
    }

    private getIcon(): vscode.ThemeIcon {
        switch (this.statusType) {
            case 'danger':
                return new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
            case 'warning':
                return new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'));
            case 'safe':
                return new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
            default:
                return new vscode.ThemeIcon('info');
        }
    }
}
