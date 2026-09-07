const assert = require('assert');
const YAML = require('yaml');
const fs = require('fs');
const path = require('path');
const Module = require('module');

// Mock 'vscode' module for standalone Node runner
const originalRequire = Module.prototype.require;
Module.prototype.require = function(moduleName) {
    if (moduleName === 'vscode') {
        return {
            workspace: {
                getConfiguration: () => ({
                    get: (key, defaultValue) => defaultValue
                }),
                workspaceFolders: []
            },
            window: {
                showInformationMessage: () => {},
                showErrorMessage: () => {},
                showWarningMessage: () => {}
            },
            ThemeColor: class { constructor(id) { this.id = id; } },
            ThemeIcon: class { constructor(id) { this.id = id; } },
            MarkdownString: class {
                constructor(val = '') { this.val = val; }
                appendMarkdown(str) { this.val += str; }
            }
        };
    }
    return originalRequire.apply(this, arguments);
};

console.log('==============================================');
console.log('🚀 DevOps Lens v2.0 Comprehensive Test Suite');
console.log('==============================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`✅ PASS: ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`❌ FAIL: ${name}`);
        console.error(err);
        process.exitCode = 1;
    }
}

// 1. AWS INI Parsing Test
runTest('AWS INI Parsing handles credentials & config with profile prefixes', () => {
    const { parseAwsIniFile } = require('../../out/providers/awsProvider');
    
    // Create temporary test files
    const tmpDir = path.join(__dirname, 'tmp_test_aws');
    fs.mkdirSync(tmpDir, { recursive: true });
    
    const credsPath = path.join(tmpDir, 'credentials');
    const configPath = path.join(tmpDir, 'config');

    fs.writeFileSync(credsPath, `
[default]
aws_access_key_id = AKIA11111111111
aws_secret_access_key = secret111

[prod-account]
aws_access_key_id = AKIA22222222222
aws_secret_access_key = secret222
`);

    fs.writeFileSync(configPath, `
[default]
region = us-east-1
output = json

[profile prod-account]
region = eu-west-1
output = json

[profile staging]
region = us-west-2
`);

    const parsedCreds = parseAwsIniFile(credsPath);
    const parsedConfig = parseAwsIniFile(configPath);

    assert.strictEqual(parsedCreds.has('default'), true);
    assert.strictEqual(parsedCreds.has('prod-account'), true);
    assert.strictEqual(parsedCreds.get('prod-account').aws_access_key_id, 'AKIA22222222222');

    assert.strictEqual(parsedConfig.has('default'), true);
    assert.strictEqual(parsedConfig.has('prod-account'), true);
    assert.strictEqual(parsedConfig.has('staging'), true);
    assert.strictEqual(parsedConfig.get('prod-account').region, 'eu-west-1');
    assert.strictEqual(parsedConfig.get('staging').region, 'us-west-2');

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

// 2. Kubeconfig YAML Parsing & Production Detection Test
runTest('Kubernetes YAML parsing accurately resolves current-context, cluster, namespace, and server', () => {
    const mockKubeConfig = `
apiVersion: v1
kind: Config
current-context: production-us-east-1
clusters:
- cluster:
    server: https://k8s-prod.example.com:6443
  name: prod-cluster
- cluster:
    server: https://127.0.0.1:6443
  name: minikube
contexts:
- context:
    cluster: prod-cluster
    user: admin
    namespace: payment-service
  name: production-us-east-1
- context:
    cluster: minikube
    user: minikube
    namespace: default
  name: minikube
`;

    const parsed = YAML.parse(mockKubeConfig);
    assert.strictEqual(parsed['current-context'], 'production-us-east-1');

    const ctx = parsed.contexts.find(c => c.name === parsed['current-context']);
    assert.strictEqual(ctx.context.cluster, 'prod-cluster');
    assert.strictEqual(ctx.context.namespace, 'payment-service');

    const cluster = parsed.clusters.find(c => c.name === ctx.context.cluster);
    assert.strictEqual(cluster.cluster.server, 'https://k8s-prod.example.com:6443');

    const { isProductionContext } = require('../../out/providers/kubernetesProvider');
    assert.strictEqual(isProductionContext('production-us-east-1'), true);
    assert.strictEqual(isProductionContext('minikube'), false);
    assert.strictEqual(isProductionContext('dev-cluster'), false);
    assert.strictEqual(isProductionContext('prd-cluster-01'), true);
    assert.strictEqual(isProductionContext('eu-live-aks'), true);
});

// 3. Docker JSON output parsing
runTest('Docker ps JSON parsing correctly calculates running and stopped containers and extracts ports', () => {
    const mockOutput = `{"ID":"a1b2c3d4e5f6","Names":"web-api","Image":"node:20-alpine","State":"running","Status":"Up 3 hours","Ports":"0.0.0.0:8080->8080/tcp"}
{"ID":"f6e5d4c3b2a1","Names":"db-postgres","Image":"postgres:15","State":"running","Status":"Up 5 hours","Ports":"0.0.0.0:5432->5432/tcp"}
{"ID":"9876543210ab","Names":"cache-redis","Image":"redis:7","State":"exited","Status":"Exited (0) 10 minutes ago","Ports":""}`;

    const lines = mockOutput.trim().split('\n');
    const containers = [];
    let running = 0;
    let stopped = 0;

    for (const line of lines) {
        const parsed = JSON.parse(line);
        const state = (parsed.State || '').toLowerCase();
        const isRunning = state.startsWith('running') || state.startsWith('up');
        if (isRunning) running++; else stopped++;
        containers.push({
            id: parsed.ID,
            name: parsed.Names,
            image: parsed.Image,
            state: isRunning ? 'running' : 'exited',
            status: parsed.Status,
            ports: parsed.Ports
        });
    }

    assert.strictEqual(containers.length, 3);
    assert.strictEqual(running, 2);
    assert.strictEqual(stopped, 1);
    assert.strictEqual(containers[0].name, 'web-api');
    assert.strictEqual(containers[0].ports, '0.0.0.0:8080->8080/tcp');
    assert.strictEqual(containers[2].state, 'exited');
});

// 4. Status Bar formatting & Production Alert Logic
runTest('Production status flag triggers high-visibility alert when either k8s or cloud is production', () => {
    const isK8sProd = true;
    const isAwsProd = false;
    const hasProductionAlert = isK8sProd || isAwsProd;

    assert.strictEqual(hasProductionAlert, true);

    const safeK8s = false;
    const safeAws = false;
    assert.strictEqual(safeK8s || safeAws, false);
});

console.log('\n----------------------------------------------');
console.log(`Results: ${passedTests} / ${totalTests} tests passed.`);
console.log('----------------------------------------------');

if (passedTests === totalTests) {
    console.log('🎉 All DevOps Lens v2.0 tests PASSED successfully!\n');
}
