import * as vscode from 'vscode';
import { getKubernetesStatus, switchKubeContext } from './providers/kubernetesProvider';
import { getAwsStatus, setActiveSessionProfile } from './providers/awsProvider';
import { getDockerStatus } from './providers/dockerProvider';
import { getGitStatus } from './providers/gitProvider';
import { getTerraformStatus, switchTerraformWorkspace } from './providers/terraformProvider';
import { getCloudStatus } from './providers/cloudProvider';
import { InfrastructureStatus, DockerContainer } from './providers/types';

export class DevOpsLensItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly options?: {
            description?: string;
            tooltip?: string | vscode.MarkdownString;
            icon?: vscode.ThemeIcon;
            contextValue?: string;
            command?: vscode.Command;
            metaId?: string;
            children?: DevOpsLensItem[];
        }
    ) {
        super(label, collapsibleState);
        this.description = options?.description;
        this.tooltip = options?.tooltip;
        if (options?.icon) {
            this.iconPath = options.icon;
        }
        if (options?.contextValue) {
            this.contextValue = options.contextValue;
        }
        if (options?.command) {
            this.command = options.command;
        }
    }

    public get children(): DevOpsLensItem[] | undefined {
        return this.options?.children;
    }

    public get metaId(): string | undefined {
        return this.options?.metaId;
    }
}

export class DevOpsLensProvider implements vscode.TreeDataProvider<DevOpsLensItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<DevOpsLensItem | undefined | null | void> =
        new vscode.EventEmitter<DevOpsLensItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<DevOpsLensItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private lastStatus: InfrastructureStatus | null = null;
    private onStatusUpdateListeners: ((status: InfrastructureStatus) => void)[] = [];

    public onStatusUpdate(listener: (status: InfrastructureStatus) => void): void {
        this.onStatusUpdateListeners.push(listener);
    }

    public refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    public getTreeItem(element: DevOpsLensItem): vscode.TreeItem {
        return element;
    }

    public async getChildren(element?: DevOpsLensItem): Promise<DevOpsLensItem[]> {
        if (element) {
            return element.children || [];
        }

        // Fetch all provider data in parallel
        const [k8s, aws, docker, git, tf, cloud] = await Promise.all([
            getKubernetesStatus(),
            getAwsStatus(),
            getDockerStatus(),
            getGitStatus(),
            getTerraformStatus(),
            getCloudStatus()
        ]);

        const hasProductionAlert = k8s.isProduction || aws.isProduction;
        let productionReason = '';
        if (k8s.isProduction) {
            productionReason += `Kubernetes context: ${k8s.context}`;
        }
        if (aws.isProduction) {
            productionReason += `${productionReason ? ', ' : ''}AWS profile: ${aws.profile}`;
        }

        this.lastStatus = {
            kubernetes: k8s,
            aws,
            docker,
            git,
            terraform: tf,
            cloud,
            hasProductionAlert,
            productionReason
        };

        // Notify status bar and other HUD listeners
        for (const listener of this.onStatusUpdateListeners) {
            try {
                listener(this.lastStatus);
            } catch {
                // Ignore listener error
            }
        }

        const items: DevOpsLensItem[] = [];

        // 1. Kubernetes Section
        items.push(this.buildKubernetesNode(k8s));

        // 2. AWS & Cloud Section
        items.push(this.buildAwsNode(aws, cloud));

        // 3. Docker Section
        items.push(this.buildDockerNode(docker));

        // 4. Git Section
        items.push(this.buildGitNode(git));

        // 5. Terraform Section (if detected)
        if (tf.detected) {
            items.push(this.buildTerraformNode(tf));
        }

        return items;
    }

    private buildKubernetesNode(k8s: any): DevOpsLensItem {
        const isProd = k8s.isProduction;
        const icon = isProd
            ? new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'))
            : k8s.context
                ? new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'))
                : new vscode.ThemeIcon('circle-slash');

        const children: DevOpsLensItem[] = [];

        if (k8s.context) {
            // Namespace child
            children.push(new DevOpsLensItem(
                `Namespace: ${k8s.namespace || 'default'}`,
                vscode.TreeItemCollapsibleState.None,
                {
                    description: 'Click to switch',
                    icon: new vscode.ThemeIcon('symbol-namespace'),
                    contextValue: 'kubeNamespaceItem',
                    command: {
                        command: 'devopsLens.switchKubeNamespace',
                        title: 'Switch Namespace'
                    }
                }
            ));

            // Cluster server if known
            if (k8s.server) {
                children.push(new DevOpsLensItem(
                    `Server: ${k8s.server}`,
                    vscode.TreeItemCollapsibleState.None,
                    {
                        icon: new vscode.ThemeIcon('server-environment')
                    }
                ));
            }

            // Expandable list of other available contexts
            if (k8s.allContexts.length > 1) {
                const contextChildren = k8s.allContexts.map((ctx: string) => {
                    const isCurrent = ctx === k8s.context;
                    return new DevOpsLensItem(
                        ctx,
                        vscode.TreeItemCollapsibleState.None,
                        {
                            description: isCurrent ? '(Active)' : undefined,
                            icon: isCurrent
                                ? new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'))
                                : new vscode.ThemeIcon('circle-outline'),
                            command: {
                                command: 'devopsLens.switchKubeContext',
                                title: 'Switch Context'
                            }
                        }
                    );
                });

                children.push(new DevOpsLensItem(
                    `All Contexts (${k8s.allContexts.length})`,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    {
                        icon: new vscode.ThemeIcon('list-unordered'),
                        children: contextChildren
                    }
                ));
            }
        }

        const tooltip = new vscode.MarkdownString();
        tooltip.isTrusted = true;
        tooltip.appendMarkdown(`### ☸️ Kubernetes Context\n\n`);
        tooltip.appendMarkdown(`- **Current Context:** \`${k8s.context || 'Not configured'}\`\n`);
        tooltip.appendMarkdown(`- **Namespace:** \`${k8s.namespace || 'default'}\`\n`);
        tooltip.appendMarkdown(`- **Status:** ${isProd ? '🔴 **PRODUCTION CLUSTER**' : '🟢 Safe Environment'}\n\n`);
        tooltip.appendMarkdown(`[Switch Context](command:devopsLens.switchKubeContext) &nbsp;|&nbsp; [Switch Namespace](command:devopsLens.switchKubeNamespace)`);

        return new DevOpsLensItem(
            'Kubernetes',
            children.length > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None,
            {
                description: k8s.context ? `${k8s.context} [${k8s.namespace || 'default'}]` : 'Not configured',
                tooltip,
                icon,
                contextValue: 'kubeRoot',
                children
            }
        );
    }

    private buildAwsNode(aws: any, cloud: any): DevOpsLensItem {
        const isProd = aws.isProduction;
        const icon = isProd
            ? new vscode.ThemeIcon('warning', new vscode.ThemeColor('errorForeground'))
            : aws.profile
                ? new vscode.ThemeIcon('cloud', new vscode.ThemeColor('symbolIcon.methodForeground'))
                : new vscode.ThemeIcon('cloud');

        const children: DevOpsLensItem[] = [];

        if (aws.profile) {
            if (aws.region) {
                children.push(new DevOpsLensItem(
                    `Region: ${aws.region}`,
                    vscode.TreeItemCollapsibleState.None,
                    { icon: new vscode.ThemeIcon('globe') }
                ));
            }

            if (aws.allProfiles.length > 1) {
                const profileChildren = aws.allProfiles.map((p: string) => {
                    const isCurrent = p === aws.profile;
                    return new DevOpsLensItem(
                        p,
                        vscode.TreeItemCollapsibleState.None,
                        {
                            description: isCurrent ? '(Active)' : undefined,
                            icon: isCurrent
                                ? new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'))
                                : new vscode.ThemeIcon('account'),
                            command: {
                                command: 'devopsLens.switchAwsProfile',
                                title: 'Switch Profile'
                            }
                        }
                    );
                });

                children.push(new DevOpsLensItem(
                    `Configured Profiles (${aws.allProfiles.length})`,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    {
                        icon: new vscode.ThemeIcon('person'),
                        children: profileChildren
                    }
                ));
            }
        }

        // Multi-cloud child nodes if present
        if (cloud.gcpProject) {
            children.push(new DevOpsLensItem(
                `GCP Project: ${cloud.gcpProject}`,
                vscode.TreeItemCollapsibleState.None,
                { icon: new vscode.ThemeIcon('vm') }
            ));
        }
        if (cloud.azureSubscription) {
            children.push(new DevOpsLensItem(
                `Azure: ${cloud.azureSubscription}`,
                vscode.TreeItemCollapsibleState.None,
                { icon: new vscode.ThemeIcon('azure') }
            ));
        }

        const tooltip = new vscode.MarkdownString();
        tooltip.isTrusted = true;
        tooltip.appendMarkdown(`### ☁️ Cloud & AWS Profile\n\n`);
        tooltip.appendMarkdown(`- **Active Profile:** \`${aws.profile || 'None'}\`\n`);
        if (aws.region) {
            tooltip.appendMarkdown(`- **Region:** \`${aws.region}\`\n`);
        }
        tooltip.appendMarkdown(`- **Environment:** ${isProd ? '🔴 **PRODUCTION ACCOUNT**' : '⚪ Standard'}\n\n`);
        tooltip.appendMarkdown(`[Switch Profile](command:devopsLens.switchAwsProfile)`);

        let cloudDescription = 'Not configured';
        if (aws.profile) {
            cloudDescription = `${aws.profile}${aws.region ? ` (@${aws.region})` : ''}`;
        } else if (cloud.gcpProject) {
            cloudDescription = `GCP: ${cloud.gcpProject}`;
        } else if (cloud.azureSubscription) {
            cloudDescription = `Azure: ${cloud.azureSubscription}`;
        }

        return new DevOpsLensItem(
            'Cloud & AWS',
            children.length > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None,
            {
                description: cloudDescription,
                tooltip,
                icon,
                contextValue: 'awsRoot',
                children
            }
        );
    }

    private buildDockerNode(docker: any): DevOpsLensItem {
        const icon = docker.isRunning
            ? new vscode.ThemeIcon('server-process', new vscode.ThemeColor('testing.iconPassed'))
            : new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'));

        const children: DevOpsLensItem[] = [];

        if (docker.isRunning) {
            if (docker.containers.length === 0) {
                children.push(new DevOpsLensItem(
                    'No containers found',
                    vscode.TreeItemCollapsibleState.None,
                    { icon: new vscode.ThemeIcon('info') }
                ));
            } else {
                for (const c of docker.containers) {
                    const isRunning = c.state === 'running';
                    const containerIcon = isRunning
                        ? new vscode.ThemeIcon('play-circle', new vscode.ThemeColor('testing.iconPassed'))
                        : new vscode.ThemeIcon('stop-circle', new vscode.ThemeColor('testing.iconQueued'));

                    const desc = `${c.image} ${c.ports ? `[${c.ports}]` : ''}`;

                    const cTooltip = new vscode.MarkdownString();
                    cTooltip.isTrusted = true;
                    cTooltip.appendMarkdown(`**Container:** \`${c.name}\`\n\n`);
                    cTooltip.appendMarkdown(`- **Image:** \`${c.image}\`\n`);
                    cTooltip.appendMarkdown(`- **Status:** ${c.status}\n`);
                    if (c.ports) {
                        cTooltip.appendMarkdown(`- **Ports:** \`${c.ports}\`\n`);
                    }
                    cTooltip.appendMarkdown(`- **ID:** \`${c.id}\`\n\n`);
                    cTooltip.appendMarkdown(`[View Logs](command:devopsLens.dockerLogs) &nbsp;|&nbsp; [Shell](command:devopsLens.dockerShell)`);

                    children.push(new DevOpsLensItem(
                        c.name,
                        vscode.TreeItemCollapsibleState.None,
                        {
                            description: desc,
                            icon: containerIcon,
                            tooltip: cTooltip,
                            contextValue: isRunning ? 'dockerContainerRunning' : 'dockerContainerStopped',
                            metaId: c.id
                        }
                    ));
                }
            }
        }

        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`### 🐳 Docker Status\n\n`);
        tooltip.appendMarkdown(`- **Daemon:** ${docker.isRunning ? '🟢 Running' : '🔴 Stopped'}\n`);
        if (docker.isRunning) {
            tooltip.appendMarkdown(`- **Running Containers:** ${docker.runningCount}\n`);
            tooltip.appendMarkdown(`- **Stopped Containers:** ${docker.stoppedCount}\n`);
        }

        const description = docker.isRunning
            ? `${docker.runningCount} Running, ${docker.stoppedCount} Stopped`
            : 'Not Running';

        return new DevOpsLensItem(
            'Docker',
            children.length > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None,
            {
                description,
                tooltip,
                icon,
                contextValue: 'dockerRoot',
                children
            }
        );
    }

    private buildGitNode(git: any): DevOpsLensItem {
        const isMain = git.isMainBranch;
        const icon = isMain
            ? new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'))
            : git.branch
                ? new vscode.ThemeIcon('git-branch', new vscode.ThemeColor('testing.iconPassed'))
                : new vscode.ThemeIcon('source-control');

        const children: DevOpsLensItem[] = [];

        if (git.branch) {
            // Working tree status
            const dirtyText = git.isClean
                ? 'Working tree clean'
                : `${git.stagedCount} staged, ${git.unstagedCount} unstaged, ${git.untrackedCount} untracked`;
            children.push(new DevOpsLensItem(
                `Working Tree: ${git.isClean ? 'Clean' : 'Dirty'}`,
                vscode.TreeItemCollapsibleState.None,
                {
                    description: dirtyText,
                    icon: git.isClean
                        ? new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'))
                        : new vscode.ThemeIcon('edit', new vscode.ThemeColor('editorWarning.foreground'))
                }
            ));

            // Sync status
            children.push(new DevOpsLensItem(
                `Sync: ↑${git.ahead} ahead, ↓${git.behind} behind`,
                vscode.TreeItemCollapsibleState.None,
                {
                    icon: new vscode.ThemeIcon('sync')
                }
            ));

            // Last commit
            if (git.lastCommit) {
                children.push(new DevOpsLensItem(
                    `Commit: [${git.lastCommit.hash}] ${git.lastCommit.message}`,
                    vscode.TreeItemCollapsibleState.None,
                    {
                        description: git.lastCommit.author ? `by ${git.lastCommit.author}` : undefined,
                        icon: new vscode.ThemeIcon('git-commit')
                    }
                ));
            }
        }

        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`### 🌿 Git Status\n\n`);
        tooltip.appendMarkdown(`- **Branch:** \`${git.branch || 'No repo'}\`\n`);
        tooltip.appendMarkdown(`- **Safety:** ${isMain ? '⚠️ **Protected Branch (main/master)**' : '🟢 Feature Branch'}\n`);
        tooltip.appendMarkdown(`- **Status:** ${git.isClean ? 'Clean' : 'Uncommitted changes'}\n`);

        return new DevOpsLensItem(
            'Git Branch',
            children.length > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None,
            {
                description: git.branch ? `${git.branch}${!git.isClean ? ' *' : ''}` : 'No repo',
                tooltip,
                icon,
                contextValue: 'gitRoot',
                children
            }
        );
    }

    private buildTerraformNode(tf: any): DevOpsLensItem {
        const children: DevOpsLensItem[] = [];

        if (tf.allWorkspaces.length > 1) {
            for (const ws of tf.allWorkspaces) {
                const isCurrent = ws === tf.workspace;
                children.push(new DevOpsLensItem(
                    ws,
                    vscode.TreeItemCollapsibleState.None,
                    {
                        description: isCurrent ? '(Active)' : undefined,
                        icon: isCurrent
                            ? new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'))
                            : new vscode.ThemeIcon('circle-outline'),
                        command: {
                            command: 'devopsLens.switchTerraformWorkspace',
                            title: 'Switch Workspace'
                        }
                    }
                ));
            }
        }

        return new DevOpsLensItem(
            'Terraform',
            children.length > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None,
            {
                description: `Workspace: ${tf.workspace || 'default'}`,
                icon: new vscode.ThemeIcon('layers'),
                contextValue: 'terraformRoot',
                children
            }
        );
    }
}
