import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { DockerContainer, DockerStatus } from './types';

const execAsync = promisify(exec);

export async function getDockerStatus(): Promise<DockerStatus> {
    try {
        // Query containers using JSON format for precise parsing
        const { stdout } = await execAsync('docker ps -a --format "{{json .}}"', {
            timeout: 4000
        });

        const lines = stdout.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
        const containers: DockerContainer[] = [];

        let runningCount = 0;
        let stoppedCount = 0;

        for (const line of lines) {
            try {
                const parsed = JSON.parse(line);
                const state = (parsed.State || parsed.Status || '').toLowerCase();
                const isRunning = state.startsWith('running') || state.startsWith('up');

                if (isRunning) {
                    runningCount++;
                } else {
                    stoppedCount++;
                }

                containers.push({
                    id: parsed.ID || '',
                    name: parsed.Names || parsed.Name || 'unnamed',
                    image: parsed.Image || '',
                    state: isRunning ? 'running' : 'exited',
                    status: parsed.Status || '',
                    ports: parsed.Ports || ''
                });
            } catch {
                // Fallback line parsing if not strict JSON
            }
        }

        return {
            isRunning: true,
            containerCount: containers.length,
            runningCount,
            stoppedCount,
            containers
        };
    } catch {
        // Fallback check if Docker is running at all via ping
        try {
            await execAsync('docker info --format "{{.ServerVersion}}"', { timeout: 2500 });
            return {
                isRunning: true,
                containerCount: 0,
                runningCount: 0,
                stoppedCount: 0,
                containers: []
            };
        } catch {
            return {
                isRunning: false,
                containerCount: 0,
                runningCount: 0,
                stoppedCount: 0,
                containers: []
            };
        }
    }
}

export async function startDockerContainer(containerId: string): Promise<boolean> {
    try {
        await execAsync(`docker start ${containerId}`, { timeout: 10000 });
        vscode.window.showInformationMessage(`Started container ${containerId}`);
        return true;
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to start container: ${error?.message || error}`);
        return false;
    }
}

export async function stopDockerContainer(containerId: string): Promise<boolean> {
    try {
        await execAsync(`docker stop ${containerId}`, { timeout: 10000 });
        vscode.window.showInformationMessage(`Stopped container ${containerId}`);
        return true;
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to stop container: ${error?.message || error}`);
        return false;
    }
}

export async function restartDockerContainer(containerId: string): Promise<boolean> {
    try {
        await execAsync(`docker restart ${containerId}`, { timeout: 10000 });
        vscode.window.showInformationMessage(`Restarted container ${containerId}`);
        return true;
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to restart container: ${error?.message || error}`);
        return false;
    }
}

let logsOutputChannel: vscode.OutputChannel | undefined;

export async function showDockerContainerLogs(containerId: string, name: string): Promise<void> {
    if (!logsOutputChannel) {
        logsOutputChannel = vscode.window.createOutputChannel('Docker Container Logs');
    }
    logsOutputChannel.show(true);
    logsOutputChannel.appendLine(`\n--- [Logs for ${name} (${containerId})] ---`);

    try {
        const { stdout, stderr } = await execAsync(`docker logs --tail 100 ${containerId}`, { timeout: 5000 });
        if (stdout) {
            logsOutputChannel.appendLine(stdout);
        }
        if (stderr) {
            logsOutputChannel.appendLine(stderr);
        }
    } catch (error: any) {
        logsOutputChannel.appendLine(`Error retrieving logs: ${error?.message || error}`);
    }
}

export function openDockerContainerShell(containerId: string, name: string): void {
    const terminal = vscode.window.createTerminal({
        name: `Docker: ${name}`,
        shellPath: 'docker',
        shellArgs: ['exec', '-it', containerId, 'sh']
    });
    terminal.show();
}
