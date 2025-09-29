import { SSTConfig } from "sst";
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { FunctionUrlAuthType, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Vpc, SubnetType } from 'aws-cdk-lib/aws-ec2';
import { Instance, InstanceType, InstanceClass, InstanceSize, MachineImage } from 'aws-cdk-lib/aws-ec2';
import { CfnKeyPair } from 'aws-cdk-lib/aws-ec2';
import { Port } from 'aws-cdk-lib/aws-ec2';
import { Role, ServicePrincipal, ManagedPolicy } from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

export default {
  config(_input) {
    return {
      name: "sentry-lambda-http-proxy-issue",
    };
  },
  stacks(app) {
    app.stack(({ stack }) => {
      const vpc = new Vpc(stack, 'VPC', {
        maxAzs: 2,
        natGateways: 1,
        subnetConfiguration: [
          {
            name: 'private',
            subnetType: SubnetType.PRIVATE_WITH_EGRESS,
          },
          {
            name: 'public',
            subnetType: SubnetType.PUBLIC,
          },
        ],
      });
      const privateSubnets = vpc.selectSubnets({ subnetType: SubnetType.PRIVATE_WITH_EGRESS });
      const publicSubnets = vpc.selectSubnets({ subnetType: SubnetType.PUBLIC });
      
      // Create IAM role for SSM agent
      const ssmRole = new Role(stack, 'SquidProxySSMRole', {
        assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
        managedPolicies: [
          ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        ],
      });

      const keyPair = new CfnKeyPair(stack, 'SquidProxyKeyPair', {
        keyName: 'SquidProxyKeyPair',
      });

      const ec2Instance = new Instance(stack, 'SquidProxyInstance', {
        vpc,
        vpcSubnets: publicSubnets,
        instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
        machineImage: MachineImage.latestAmazonLinux2023(),
        keyName: keyPair.keyName,
        role: ssmRole,
        userDataCausesReplacement: true,
      });
      ec2Instance.connections.allowFromAnyIpv4(Port.tcp(22), 'Allow SSH access');
      ec2Instance.connections.allowFromAnyIpv4(Port.tcp(3128), 'Allow Squid proxy access');

      // Setup Squid proxy on the EC2 instance
      ec2Instance.addUserData(
        '#!/bin/bash',
        'yum install -y squid',
        'systemctl enable squid',
        'systemctl start squid',
        'sed -i "s/^http_access deny all/http_access allow all/" /etc/squid/squid.conf',
        'systemctl restart squid',
      );
      const sharedLambdaConfig = {
        entry: path.join(import.meta.dirname, './function.ts'),
        handler: 'index.handler',
        environment: {
          SENTRY_DSN: process.env.SENTRY_DSN || '',
          SENTRY_DEBUG: 'true',
          USE_SENTRY_WRAPPER: process.env.USE_SENTRY_WRAPPER || '',
          NODE_OPTIONS: "--import @sentry/aws-serverless/awslambda-auto",
          http_proxy: `http://${ec2Instance.instancePrivateIp}:3128`,
          https_proxy: `http://${ec2Instance.instancePrivateIp}:3128`,
        },
        vpc,
        vpcSubnets: privateSubnets,
        runtime: Runtime.NODEJS_22_X,
        bundling: {
          format: OutputFormat.ESM,
          commandHooks: {
            beforeBundling(inputDir: string, outputDir: string): string[] {
              return [];
            },
            beforeInstall(): string[] {
              return [];
            },
            afterBundling(inputDir: string, outputDir: string): string[] {
              // Required to so node reads `"type": "module"` and interprets index.js as an ES module
              return [`cp ${inputDir}/package.json ${outputDir}`];
            },
          },
        },
      };
      
      const sentry = LayerVersion.fromLayerVersionArn(
        stack,
        "SentryLayer",
        `arn:aws:lambda:${stack.region}:943013980633:layer:SentryNodeServerlessSDKv10:23`,
      );
      const fnWithLayer = new NodejsFunction(stack, 'sentry-lambda-http-proxy-issue-with-layer', {
        ...sharedLambdaConfig,
        layers: [sentry],
      });
      const fnWithLayerUrl = fnWithLayer.addFunctionUrl({ authType: FunctionUrlAuthType.NONE });
      
      const fnWithNpm = new NodejsFunction(stack, 'sentry-lambda-http-proxy-issue-with-npm', {
        ...sharedLambdaConfig,
        bundling: {
          ...sharedLambdaConfig.bundling,
          nodeModules: ['@sentry/aws-serverless'],
        },
      });
      const fnWithNpmUrl = fnWithNpm.addFunctionUrl({ authType: FunctionUrlAuthType.NONE });

      stack.addOutputs({
        FunctionWithLayerUrl: fnWithLayerUrl.url,
        FunctionWithNpmUrl: fnWithNpmUrl.url,
      });
    });
  },
} satisfies SSTConfig;
