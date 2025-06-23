import * as cdk from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { join } from 'path';

export class RdsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const dbCredentialsSecret = new secretsmanager.Secret(
      this,
      'DBCredentialsSecret',
      {
        secretName: 'DBCredentialsName',
        generateSecretString: {
          secretStringTemplate: JSON.stringify({
            username: 'myadminuser',
          }),
          excludePunctuation: true,
          includeSpace: false,
          generateStringKey: 'password',
        },
      },
    );

    const vpc = new ec2.Vpc(this, 'MyVPC', {
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    const dbInstance = new rds.DatabaseInstance(this, 'RDSInstance', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_13,
      }),

      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.BURSTABLE3,
        ec2.InstanceSize.MICRO,
      ),
      vpc,
      credentials: rds.Credentials.fromSecret(dbCredentialsSecret),
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      multiAz: false,
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      allowMajorVersionUpgrade: false,
      autoMinorVersionUpgrade: true,
      backupRetention: cdk.Duration.days(7),
      deleteAutomatedBackups: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
      databaseName: 'databaseName',
    });

    const nestJsLambda = new lambdaNodejs.NodejsFunction(this, 'NestJsLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: join(__dirname, '..', '..', 'dist', 'src', 'main.js'),
      environment: {
        DB_HOST: dbInstance.dbInstanceEndpointAddress,
        DB_PORT: '5432', // default DB port
        DB_NAME: 'databaseName',
        DB_USER: dbCredentialsSecret
          .secretValueFromJson('username')
          .unsafeUnwrap(),
        DB_PASSWORD: dbCredentialsSecret
          .secretValueFromJson('password')
          .unsafeUnwrap(),
      },
      bundling: {
        externalModules: [
          '@nestjs/microservices',
          'class-transformer',
          '@nestjs/websockets/socket-module',
          'cache-manager',
          'class-validator',
        ],
      },
      vpc,
      allowPublicSubnet: true,
      securityGroups: [dbInstance.connections.securityGroups[0]],
      timeout: cdk.Duration.seconds(30),
    });

    // Lambda
    // const nestJsLambda = new lambda.Function(this, 'NestJsLambda', {
    //   runtime: lambda.Runtime.NODEJS_20_X,
    //   handler: 'main.handler',
    //   code: lambda.Code.fromAsset(join(__dirname, '..', '..', 'dist', 'src')),
    //   environment: {
    //     DB_HOST: dbInstance.dbInstanceEndpointAddress,
    //     DB_PORT: '5432', // default DB port
    //     DB_NAME: 'databaseName',
    //     DB_USER: dbCredentialsSecret
    //       .secretValueFromJson('username')
    //       .unsafeUnwrap(),
    //     DB_PASSWORD: dbCredentialsSecret
    //       .secretValueFromJson('password')
    //       .unsafeUnwrap(),
    //   },
    //   vpc,
    //   allowPublicSubnet: true,
    //   securityGroups: [dbInstance.connections.securityGroups[0]],
    //   timeout: cdk.Duration.seconds(30),
    // });

    dbCredentialsSecret.grantRead(nestJsLambda);
    dbInstance.connections.allowDefaultPortFrom(nestJsLambda);

    new apigateway.LambdaRestApi(this, 'NestJsApiGateway', {
      handler: nestJsLambda,
      proxy: true,
    });
  }
}
