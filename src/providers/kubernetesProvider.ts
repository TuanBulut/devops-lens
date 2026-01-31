import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface KubernetesStatus {
    context: string | null;
    isProduction: boolean;
}

// Keywords that indicate a production environment
const PRODUCTION_KEYWORDS = [
    'prod',
    'production',
    'prd',
    'live',
    'master-cluster',
    'main-cluster'
];

export async function getKubernetesStatus(): Promise<KubernetesStatus> {
    try {
        const { stdout } = await execAsync('kubectl config current-context', {
            timeout: 5000
        });

        const context = stdout.trim();
        const isProduction = PRODUCTION_KEYWORDS.some(keyword =>
            context.toLowerCase().includes(keyword)
        );

        return {
            context,
            isProduction
        };
    } catch (error) {
        // kubectl not installed or not configured
        return {
            context: null,
            isProduction: false
        };
    }
}
