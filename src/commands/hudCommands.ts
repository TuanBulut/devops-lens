import * as vscode from 'vscode';
import { getKubernetesStatus, switchKubeContext, switchKubeNamespace, fetchClusterNamespaces } from '../providers/kubernetesProvider';
import { getAwsStatus, setActiveSessionProfile } from '../providers/awsProvider';
import {
    getDockerStatus,
    startDockerContainer,
    stopDockerContainer,
    restartDockerContainer,
    showDockerContainerLogs,
    openDockerContainerShell
} from '../providers/dockerProvider';
import { getGitStatus } from '../providers/gitProvider';
import { getTerraformStatus, switchTerraformWorkspace } from '../providers/terraformProvider';
import { DevOpsLensItem } from '../devopsLensProvider';

export function registerHudCommands(
    context: vscode.ExtensionContext,
    refreshProvider: () => void
): void {
    // 1. Open interactive Heads-Up Display (QuickPick Dashboard)
    context.subscriptions.push(
        vscode.commands.registerCommand('devopsLens.openHud', async () => {
            const [k8s, aws, docker, git, tf] = await Promise.all([
                getKubernetesStatus(),
                getAwsStatus(),
                getDockerStatus(),
                getGitStatus(),
                getTerraformStatus()
            ]);

            const items: vscode.QuickPickItem[] = [];

            // Kubernetes Option
            const k8sLabel = k8s.isProduction ? '☸️ $(error) Kubernetes [PRODUCTION]' : '☸️ $(shield) Kubernetes';
            items.push({
                label: k8sLabel,
                description: k8s.context ? `${k8s.context} (ns: ${k8s.namespace || 'default'})` : 'Not configured',
                detail: 'Click to switch cluster context or namespace',
                picked: false
            });

            // AWS Option
            const awsLabel = aws.isProduction ? '☁️ $(alert) AWS [PRODUCTION]' : '☁️ $(cloud) AWS Profile';
            items.push({
                label: awsLabel,
                description: aws.profile ? `${aws.profile} ${aws.region ? `(@${aws.region})` : ''}` : 'Not configured',
                detail: 'Click to switch active AWS profile',
                picked: false
            });

            // Docker Option
            items.push({
                label: '🐳 $(server) Docker Containers',
                description: docker.isRunning ? `${docker.runningCount} running, ${docker.stoppedCount} stopped` : 'Daemon stopped',
                detail: 'Click to manage running/stopped containers, logs, and shell',
                picked: false
            });

            // Git Option
            if (git.branch) {
                items.push({
                    label: `🌿 $(git-branch) Git: ${git.branch}`,
                    description: git.isClean ? 'Clean working tree' : `${git.stagedCount + git.unstagedCount + git.untrackedCount} uncommitted changes`,
                    detail: `Ahead: ${git.ahead} | Behind: ${git.behind} | Last: ${git.lastCommit?.message || 'None'}`
                });
            }

            // Terraform Option
            if (tf.detected) {
                items.push({
                    label: '🌱 $(layers) Terraform Workspace',
                    description: `Active: ${tf.workspace || 'default'}`,
                    detail: 'Click to switch active workspace'
                });
            }

            // Terminal Launcher
            items.push({
                label: '💻 $(terminal) Launch DevOps Terminal',
                description: 'Pre-configured with active AWS_PROFILE and KUBECONFIG',
                detail: 'Opens an integrated terminal in this environment'
            });

            // Refresh Option
            items.push({
                label: '↻ $(refresh) Refresh Infrastructure Status',
                description: 'Force refresh all providers immediately'
            });

            const picked = await vscode.window.showQuickPick(items, {
                placeHolder: 'DevOps Lens HUD — Select an action or switch context'
            });

            if (!picked) {
                return;
            }

            if (picked.label.includes('Kubernetes')) {
                const subPick = await vscode.window.showQuickPick([
                    { label: '$(arrow-swap) Switch Kubernetes Context', id: 'context' },
                    { label: '$(symbol-namespace) Switch Namespace', id: 'namespace' }
                ], { placeHolder: 'Kubernetes Actions' });

                if (subPick?.id === 'context') {
                    vscode.commands.executeCommand('devopsLens.switchKubeContext');
                } else if (subPick?.id === 'namespace') {
                    vscode.commands.executeCommand('devopsLens.switchKubeNamespace');
                }
            } else if (picked.label.includes('AWS')) {
                vscode.commands.executeCommand('devopsLens.switchAwsProfile');
            } else if (picked.label.includes('Docker')) {
                showDockerManagementMenu();
            } else if (picked.label.includes('Terraform')) {
                vscode.commands.executeCommand('devopsLens.switchTerraformWorkspace');
            } else if (picked.label.includes('Launch DevOps Terminal')) {
                vscode.commands.executeCommand('devopsLens.openTerminal');
            } else if (picked.label.includes('Refresh')) {
                refreshProvider();
            }
        })
    );

    // 2. Switch Kubernetes Context
    context.subscriptions.push(
        vscode.commands.registerCommand('devopsLens.switchKubeContext', async () => {
            const k8s = await getKubernetesStatus();
            if (k8s.allContexts.length === 0) {
                vscode.window.showWarningMessage('No Kubernetes contexts found in configuration.');
                return;
            }

            const items: vscode.QuickPickItem[] = k8s.allContexts.map(c => {
                const isCurrent = c === k8s.context;
                return {
                    label: `${isCurrent ? '$(check) ' : ''}${c}`,
                    description: isCurrent ? '(Active Context)' : undefined,
                    detail: c.toLowerCase().includes('prod') ? '⚠️ Production cluster' : undefined
                };
            });

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: `Select Kubernetes Context (Current: ${k8s.context || 'None'})`
            });

            if (selected) {
                const rawName = selected.label.replace('$(check) ', '').trim();
                const success = await switchKubeContext(rawName);
                if (success) {
                    vscode.window.showInformationMessage(`Active Kubernetes context: ${rawName}`);
                    refreshProvider();
                }
            }
        })
    );

    // 3. Switch Kubernetes Namespace
    context.subscriptions.push(
        vscode.commands.registerCommand('devopsLens.switchKubeNamespace', async () => {
            const k8s = await getKubernetesStatus();
            const clusterNamespaces = await fetchClusterNamespaces();

            const items: vscode.QuickPickItem[] = [
                ...clusterNamespaces.map(ns => ({
                    label: `${ns === k8s.namespace ? '$(check) ' : ''}${ns}`,
                    description: ns === k8s.namespace ? '(Current Namespace)' : undefined
                })),
                {
                    label: '$(add) Enter custom namespace...',
                    description: 'Specify a namespace manually'
                }
            ];

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: `Select Namespace for context "${k8s.context || 'cluster'}" (Current: ${k8s.namespace || 'default'})`
            });

            if (!selected) {
                return;
            }

            let targetNamespace: string | undefined;
            if (selected.label.includes('Enter custom namespace')) {
                targetNamespace = await vscode.window.showInputBox({
                    prompt: 'Enter Kubernetes namespace name',
                    placeHolder: 'e.g. dev, production, staging'
                });
            } else {
                targetNamespace = selected.label.replace('$(check) ', '').trim();
            }

            if (targetNamespace) {
                const success = await switchKubeNamespace(targetNamespace);
                if (success) {
                    vscode.window.showInformationMessage(`Kubernetes namespace set to: ${targetNamespace}`);
                    refreshProvider();
                }
            }
        })
    );

    // 4. Switch AWS Profile
    context.subscriptions.push(
        vscode.commands.registerCommand('devopsLens.switchAwsProfile', async () => {
            const aws = await getAwsStatus();
            if (aws.allProfiles.length === 0) {
                vscode.window.showWarningMessage('No AWS profiles found in ~/.aws/credentials or ~/.aws/config.');
                return;
            }

            const items: vscode.QuickPickItem[] = aws.allProfiles.map(p => {
                const isCurrent = p === aws.profile;
                return {
                    label: `${isCurrent ? '$(check) ' : ''}${p}`,
                    description: isCurrent ? '(Active Profile)' : undefined,
                    detail: p.toLowerCase().includes('prod') ? '⚠️ Production AWS Account' : undefined
                };
            });

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: `Select AWS Profile (Current: ${aws.profile || 'None'})`
            });

            if (selected) {
                const rawProfile = selected.label.replace('$(check) ', '').trim();
                setActiveSessionProfile(rawProfile);
                vscode.window.showInformationMessage(`Active AWS profile set to: ${rawProfile}`);
                refreshProvider();
            }
        })
    );

    // 5. Switch Terraform Workspace
    context.subscriptions.push(
        vscode.commands.registerCommand('devopsLens.switchTerraformWorkspace', async () => {
            const tf = await getTerraformStatus();
            if (!tf.detected || tf.allWorkspaces.length === 0) {
                vscode.window.showWarningMessage('No Terraform configuration or workspaces detected.');
                return;
            }

            const items = tf.allWorkspaces.map(w => ({
                label: `${w === tf.workspace ? '$(check) ' : ''}${w}`,
                description: w === tf.workspace ? '(Active Workspace)' : undefined
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: `Select Terraform Workspace (Current: ${tf.workspace || 'default'})`
            });

            if (selected) {
                const rawName = selected.label.replace('$(check) ', '').trim();
                const success = await switchTerraformWorkspace(rawName);
                if (success) {
                    refreshProvider();
                }
            }
        })
    );

    // 6. Launch Terminal with Environment
    context.subscriptions.push(
        vscode.commands.registerCommand('devopsLens.openTerminal', async () => {
            const [k8s, aws] = await Promise.all([
                getKubernetesStatus(),
                getAwsStatus()
            ]);

            const config = vscode.workspace.getConfiguration('devopsLens');
            const warnProd = config.get<boolean>('warnOnProductionTerminal', true);

            if (warnProd && (k8s.isProduction || aws.isProduction)) {
                const warningMsg = `⚠️ Connected to PRODUCTION (${k8s.isProduction ? `K8s: ${k8s.context}` : ''} ${aws.isProduction ? `AWS: ${aws.profile}` : ''}). Proceed opening terminal?`;
                const choice = await vscode.window.showWarningMessage(warningMsg, 'Open Terminal', 'Cancel');
                if (choice !== 'Open Terminal') {
                    return;
                }
            }

            const env: Record<string, string> = {};
            if (aws.profile) {
                env.AWS_PROFILE = aws.profile;
            }
            if (aws.region) {
                env.AWS_REGION = aws.region;
                env.AWS_DEFAULT_REGION = aws.region;
            }

            const terminal = vscode.window.createTerminal({
                name: `DevOps HUD (${k8s.context || 'local'})`,
                env
            });
            terminal.show();

            vscode.window.showInformationMessage(`DevOps Terminal launched [AWS: ${aws.profile || 'default'}, K8s: ${k8s.context || 'default'}]`);
        })
    );

    // 7. Docker Container Commands (Start, Stop, Restart, Logs, Shell)
    context.subscriptions.push(
        vscode.commands.registerCommand('devopsLens.dockerStart', async (item?: DevOpsLensItem) => {
            const containerId = item?.metaId || await pickDockerContainerId('Select container to start', 'exited');
            if (containerId) {
                await startDockerContainer(containerId);
                refreshProvider();
            }
        }),
        vscode.commands.registerCommand('devopsLens.dockerStop', async (item?: DevOpsLensItem) => {
            const containerId = item?.metaId || await pickDockerContainerId('Select container to stop', 'running');
            if (containerId) {
                await stopDockerContainer(containerId);
                refreshProvider();
            }
        }),
        vscode.commands.registerCommand('devopsLens.dockerRestart', async (item?: DevOpsLensItem) => {
            const containerId = item?.metaId || await pickDockerContainerId('Select container to restart');
            if (containerId) {
                await restartDockerContainer(containerId);
                refreshProvider();
            }
        }),
        vscode.commands.registerCommand('devopsLens.dockerLogs', async (item?: DevOpsLensItem) => {
            const containerId = item?.metaId || await pickDockerContainerId('Select container to view logs');
            const name = item?.label?.toString() || containerId || 'container';
            if (containerId) {
                await showDockerContainerLogs(containerId, name);
            }
        }),
        vscode.commands.registerCommand('devopsLens.dockerShell', async (item?: DevOpsLensItem) => {
            const containerId = item?.metaId || await pickDockerContainerId('Select container for shell exec', 'running');
            const name = item?.label?.toString() || containerId || 'container';
            if (containerId) {
                openDockerContainerShell(containerId, name);
            }
        })
    );
}

async function pickDockerContainerId(placeHolder: string, filterState?: 'running' | 'exited'): Promise<string | undefined> {
    const docker = await getDockerStatus();
    if (!docker.isRunning || docker.containers.length === 0) {
        vscode.window.showInformationMessage('No Docker containers found.');
        return undefined;
    }

    let list = docker.containers;
    if (filterState) {
        list = list.filter(c => c.state === filterState);
    }

    const items = list.map(c => ({
        label: `${c.state === 'running' ? '$(play)' : '$(debug-stop)'} ${c.name}`,
        description: c.image,
        detail: `ID: ${c.id.substring(0, 12)} | Status: ${c.status} | Ports: ${c.ports || 'none'}`,
        id: c.id
    }));

    const picked = await vscode.window.showQuickPick(items, { placeHolder });
    return picked?.id;
}

async function showDockerManagementMenu(): Promise<void> {
    const docker = await getDockerStatus();
    if (!docker.isRunning) {
        vscode.window.showWarningMessage('Docker daemon is not running.');
        return;
    }

    const actions = [
        { label: '$(play) Start a Container', id: 'start' },
        { label: '$(debug-stop) Stop a Container', id: 'stop' },
        { label: '$(sync) Restart a Container', id: 'restart' },
        { label: '$(output) View Container Logs', id: 'logs' },
        { label: '$(terminal) Exec Shell in Container', id: 'shell' }
    ];

    const action = await vscode.window.showQuickPick(actions, {
        placeHolder: `Manage Docker (${docker.runningCount} running, ${docker.stoppedCount} stopped)`
    });

    if (!action) {
        return;
    }

    switch (action.id) {
        case 'start':
            vscode.commands.executeCommand('devopsLens.dockerStart');
            break;
        case 'stop':
            vscode.commands.executeCommand('devopsLens.dockerStop');
            break;
        case 'restart':
            vscode.commands.executeCommand('devopsLens.dockerRestart');
            break;
        case 'logs':
            vscode.commands.executeCommand('devopsLens.dockerLogs');
            break;
        case 'shell':
            vscode.commands.executeCommand('devopsLens.dockerShell');
            break;
    }
}
