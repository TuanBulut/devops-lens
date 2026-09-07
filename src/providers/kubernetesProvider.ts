import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as YAML from 'yaml';
import { KubeStatus } from './types';

const execAsync = promisify(exec);

export function getKubeConfigPath(): string {
    if (process.env.KUBECONFIG) {
        const paths = process.env.KUBECONFIG.split(path.delimiter);
        if (paths.length > 0 && fs.existsSync(paths[0])) {
            return paths[0];
        }
    }
    return path.join(os.homedir(), '.kube', 'config');
}

export function isProductionContext(name: string | null | undefined, keywords?: string[]): boolean {
    if (!name) {
        return false;
    }
    const checkKeywords = keywords && keywords.length > 0
        ? keywords
        : ['prod', 'production', 'prd', 'live', 'main-cluster', 'master-cluster'];
    const lower = name.toLowerCase();
    return checkKeywords.some(k => lower.includes(k.toLowerCase()));
}

interface ParsedKubeConfig {
    'current-context'?: string;
    contexts?: Array<{
        name: string;
        context: {
            cluster?: string;
            user?: string;
            namespace?: string;
        };
    }>;
    clusters?: Array<{
        name: string;
        cluster: {
            server?: string;
        };
    }>;
}

export async function getKubernetesStatus(): Promise<KubeStatus> {
    const config = vscode.workspace.getConfiguration('devopsLens');
    const customKeywords = config.get<string[]>('productionKeywords', []);

    // 1. First attempt: Direct ultra-fast parse of kubeconfig file (< 2ms)
    try {
        const kubePath = getKubeConfigPath();
        if (fs.existsSync(kubePath)) {
            const content = fs.readFileSync(kubePath, 'utf-8');
            const parsed = YAML.parse(content) as ParsedKubeConfig;

            if (parsed && parsed['current-context']) {
                const currentContextName = parsed['current-context'];
                const matchedContext = parsed.contexts?.find(c => c.name === currentContextName);
                const clusterName = matchedContext?.context?.cluster || null;
                const namespace = matchedContext?.context?.namespace || 'default';

                let serverUrl: string | null = null;
                if (clusterName && parsed.clusters) {
                    const matchedCluster = parsed.clusters.find(c => c.name === clusterName);
                    serverUrl = matchedCluster?.cluster?.server || null;
                }

                const allContexts = (parsed.contexts || []).map(c => c.name);
                const isProduction = isProductionContext(currentContextName, customKeywords) ||
                    (clusterName ? isProductionContext(clusterName, customKeywords) : false);

                return {
                    context: currentContextName,
                    cluster: clusterName,
                    namespace,
                    isProduction,
                    allContexts,
                    namespaces: [],
                    server: serverUrl
                };
            }
        }
    } catch {
        // Fallback to CLI
    }

    // 2. Fallback attempt: CLI execution
    try {
        const { stdout: contextOut } = await execAsync('kubectl config current-context', { timeout: 3000 });
        const context = contextOut.trim();

        if (context) {
            let namespace = 'default';
            try {
                const { stdout: nsOut } = await execAsync('kubectl config view --minify --output "jsonpath={..namespace}"', { timeout: 2000 });
                if (nsOut.trim()) {
                    namespace = nsOut.trim();
                }
            } catch {
                // Ignore namespace fetch failure
            }

            let allContexts: string[] = [context];
            try {
                const { stdout: contextsOut } = await execAsync('kubectl config get-contexts -o name', { timeout: 2000 });
                allContexts = contextsOut.trim().split('\n').map(c => c.trim()).filter(c => c.length > 0);
            } catch {
                // Ignore
            }

            return {
                context,
                cluster: null,
                namespace,
                isProduction: isProductionContext(context, customKeywords),
                allContexts,
                namespaces: []
            };
        }
    } catch {
        // kubectl not configured or error
    }

    return {
        context: null,
        cluster: null,
        namespace: null,
        isProduction: false,
        allContexts: [],
        namespaces: []
    };
}

export async function switchKubeContext(contextName: string): Promise<boolean> {
    try {
        await execAsync(`kubectl config use-context "${contextName}"`, { timeout: 5000 });
        return true;
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to switch Kubernetes context: ${error?.message || error}`);
        return false;
    }
}

export async function switchKubeNamespace(namespace: string): Promise<boolean> {
    try {
        await execAsync(`kubectl config set-context --current --namespace="${namespace}"`, { timeout: 5000 });
        return true;
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to set Kubernetes namespace: ${error?.message || error}`);
        return false;
    }
}

export async function fetchClusterNamespaces(): Promise<string[]> {
    try {
        const { stdout } = await execAsync('kubectl get namespaces -o jsonpath="{.items[*].metadata.name}"', { timeout: 4000 });
        return stdout.trim().split(/\s+/).filter(Boolean);
    } catch {
        return ['default', 'kube-system', 'kube-public', 'kube-node-lease'];
    }
}
