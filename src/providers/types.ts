export interface KubeStatus {
    context: string | null;
    cluster: string | null;
    namespace: string | null;
    isProduction: boolean;
    allContexts: string[];
    namespaces: string[];
    server?: string | null;
}

export interface AwsStatus {
    profile: string | null;
    region: string | null;
    accountId: string | null;
    isProduction: boolean;
    allProfiles: string[];
}

export interface DockerContainer {
    id: string;
    name: string;
    image: string;
    state: 'running' | 'exited' | 'paused' | 'restarting' | 'unknown';
    status: string;
    ports: string;
}

export interface DockerStatus {
    isRunning: boolean;
    containerCount: number;
    runningCount: number;
    stoppedCount: number;
    containers: DockerContainer[];
    version?: string | null;
}

export interface GitStatus {
    branch: string | null;
    isMainBranch: boolean;
    isClean: boolean;
    stagedCount: number;
    unstagedCount: number;
    untrackedCount: number;
    ahead: number;
    behind: number;
    lastCommit: {
        hash: string;
        message: string;
        author: string;
    } | null;
}

export interface TerraformStatus {
    detected: boolean;
    workspace: string | null;
    allWorkspaces: string[];
}

export interface CloudStatus {
    gcpProject: string | null;
    azureSubscription: string | null;
}

export interface InfrastructureStatus {
    kubernetes: KubeStatus;
    aws: AwsStatus;
    docker: DockerStatus;
    git: GitStatus;
    terraform?: TerraformStatus;
    cloud?: CloudStatus;
    hasProductionAlert: boolean;
    productionReason?: string;
}
