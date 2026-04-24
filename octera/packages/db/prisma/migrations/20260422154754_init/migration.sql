-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'BROKER', 'CLIENT', 'USER');

-- CreateEnum
CREATE TYPE "DomainStatus" AS ENUM ('ACTIVE', 'PENDING', 'EXPIRED', 'TRANSFERRING', 'TRANSFER');

-- CreateEnum
CREATE TYPE "SSLStatus" AS ENUM ('NONE', 'PENDING', 'ACTIVE', 'EXPIRED', 'RENEWING');

-- CreateEnum
CREATE TYPE "SSLType" AS ENUM ('FREE', 'STANDARD', 'WILDCARD', 'EV');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RegistrarProvider" AS ENUM ('GIGTECH', 'GODADDY');

-- CreateEnum
CREATE TYPE "DnsRecordType" AS ENUM ('A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV');

-- CreateEnum
CREATE TYPE "HostingStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED', 'PENDING');

-- CreateEnum
CREATE TYPE "HostingPlanType" AS ENUM ('STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'DEDICATED');

-- CreateEnum
CREATE TYPE "CartItemType" AS ENUM ('DOMAIN', 'HOSTING', 'LISTING');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('FIXED_PRICE', 'AUCTION', 'MAKE_OFFER');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'SOLD', 'EXPIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('NONE', 'PENDING', 'IN_ESCROW', 'RELEASED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "BrokerageStatus" AS ENUM ('SUBMITTED', 'RESEARCHING', 'NEGOTIATING', 'DUE_DILIGENCE', 'CLOSING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BrokeragePriority" AS ENUM ('STANDARD', 'URGENT');

-- CreateEnum
CREATE TYPE "MessageSenderRole" AS ENUM ('CLIENT', 'BROKER');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('MESSAGE', 'STATUS_UPDATE', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "K8sStatus" AS ENUM ('CREATING', 'ACTIVE', 'UPGRADING', 'DELETING', 'ERROR');

-- CreateEnum
CREATE TYPE "ServerlessRuntime" AS ENUM ('NODEJS18', 'NODEJS20', 'PYTHON311', 'PYTHON312', 'GO121', 'RUST');

-- CreateEnum
CREATE TYPE "ServerlessStatus" AS ENUM ('DEPLOYING', 'ACTIVE', 'INACTIVE', 'ERROR');

-- CreateEnum
CREATE TYPE "DbEngine" AS ENUM ('POSTGRESQL', 'MYSQL', 'MONGODB', 'REDIS', 'CASSANDRA');

-- CreateEnum
CREATE TYPE "DbStatus" AS ENUM ('CREATING', 'ACTIVE', 'BACKING_UP', 'UPGRADING', 'ERROR');

-- CreateEnum
CREATE TYPE "DbSize" AS ENUM ('SMALL', 'MEDIUM', 'LARGE', 'XLARGE');

-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('DRAFT', 'DEPLOYING', 'ACTIVE', 'ERROR');

-- CreateEnum
CREATE TYPE "PipelineTrigger" AS ENUM ('MANUAL', 'GIT_PUSH', 'API_WEBHOOK', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "PipelineStatus" AS ENUM ('IDLE', 'RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "PipelineRunStatus" AS ENUM ('BUILDING', 'TESTING', 'DEPLOYING', 'SUCCESS', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('DOMAIN_EXPIRY', 'AUCTION_BID', 'AUCTION_WON', 'AUCTION_LOST', 'BROKERAGE_UPDATE', 'DEPLOYMENT_FAILURE', 'DEPLOYMENT_SUCCESS', 'ALERT_TRIGGERED', 'OFFER_RECEIVED');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DigestFrequency" AS ENUM ('NONE', 'DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "AlertServiceType" AS ENUM ('HOSTING', 'KUBERNETES', 'SERVERLESS', 'DATABASE');

-- CreateEnum
CREATE TYPE "AlertMetric" AS ENUM ('CPU', 'MEMORY', 'DISK', 'BANDWIDTH', 'RESPONSE_TIME', 'ERROR_RATE', 'INVOCATIONS', 'CONNECTIONS');

-- CreateEnum
CREATE TYPE "AlertCondition" AS ENUM ('ABOVE', 'BELOW');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "permissions" JSONB,
    "stripeCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Domain" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "status" "DomainStatus" NOT NULL DEFAULT 'PENDING',
    "registrationDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "pricePerYear" DECIMAL(10,2),
    "registrar" "RegistrarProvider" NOT NULL,
    "registrarDomainId" TEXT,
    "privacyProtection" BOOLEAN NOT NULL DEFAULT true,
    "transferCode" TEXT,
    "transferStatus" "TransferStatus",
    "transferDate" TIMESTAMP(3),
    "previousRegistrar" TEXT,
    "sslStatus" "SSLStatus" NOT NULL DEFAULT 'NONE',
    "sslType" "SSLType",
    "sslExpiryDate" TIMESTAMP(3),
    "sslAutoRenew" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DnsRecord" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "type" "DnsRecordType" NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "ttl" INTEGER NOT NULL DEFAULT 3600,
    "priority" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DnsRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HostingPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "HostingStatus" NOT NULL DEFAULT 'PENDING',
    "planType" "HostingPlanType" NOT NULL DEFAULT 'STARTER',
    "vcpuCores" INTEGER,
    "ramGb" INTEGER,
    "storageGb" INTEGER,
    "bandwidthTb" INTEGER,
    "pricePerMonth" DECIMAL(10,2),
    "nodeLocation" TEXT,
    "ipAddress" TEXT,
    "startDate" TIMESTAMP(3),
    "nextBillingDate" TIMESTAMP(3),
    "providerInstanceId" TEXT,
    "sslStatus" "SSLStatus" NOT NULL DEFAULT 'NONE',
    "sslType" "SSLType",
    "sslExpiryDate" TIMESTAMP(3),
    "sslAutoRenew" BOOLEAN NOT NULL DEFAULT true,
    "sslDomains" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HostingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemType" "CartItemType" NOT NULL,
    "itemName" TEXT NOT NULL,
    "durationYears" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(10,2) NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainListing" (
    "id" TEXT NOT NULL,
    "domainName" TEXT NOT NULL,
    "listingType" "ListingType" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currentBid" DECIMAL(10,2),
    "reservePrice" DECIMAL(10,2),
    "auctionEndDate" TIMESTAMP(3),
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "valuation" DECIMAL(10,2),
    "ageYears" DOUBLE PRECISION,
    "monthlyTraffic" INTEGER,
    "backlinks" INTEGER,
    "domainAuthority" INTEGER,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT,
    "escrowStatus" "EscrowStatus" NOT NULL DEFAULT 'NONE',
    "stripePaymentIntentId" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomainListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainOffer" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "domainName" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "offerAmount" DECIMAL(10,2) NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomainOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerRating" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "listingId" TEXT,
    "rating" INTEGER NOT NULL,
    "review" TEXT,
    "communication" INTEGER,
    "transferSpeed" INTEGER,
    "asDescribed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerageRequest" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "brokerId" TEXT,
    "targetDomain" TEXT NOT NULL,
    "budgetMax" DECIMAL(10,2) NOT NULL,
    "status" "BrokerageStatus" NOT NULL DEFAULT 'SUBMITTED',
    "brokerNotes" TEXT,
    "timelineDays" INTEGER,
    "currentOffer" DECIMAL(10,2),
    "sellerResponse" TEXT,
    "dueDiligenceReport" JSONB,
    "priority" "BrokeragePriority" NOT NULL DEFAULT 'STANDARD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerageRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerageMessage" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "senderRole" "MessageSenderRole" NOT NULL,
    "message" TEXT NOT NULL,
    "attachments" TEXT[],
    "messageType" "MessageType" NOT NULL DEFAULT 'MESSAGE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrokerageMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KubernetesCluster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "K8sStatus" NOT NULL DEFAULT 'CREATING',
    "k8sVersion" TEXT NOT NULL DEFAULT '1.28',
    "region" TEXT,
    "nodePools" JSONB,
    "totalNodes" INTEGER,
    "endpoint" TEXT,
    "monitoringEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoScaling" BOOLEAN NOT NULL DEFAULT false,
    "pricePerMonth" DECIMAL(10,2),
    "providerClusterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KubernetesCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerlessFunction" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "runtime" "ServerlessRuntime" NOT NULL DEFAULT 'NODEJS20',
    "status" "ServerlessStatus" NOT NULL DEFAULT 'DEPLOYING',
    "memoryMb" INTEGER NOT NULL DEFAULT 256,
    "timeoutSeconds" INTEGER NOT NULL DEFAULT 30,
    "endpoint" TEXT,
    "envVariables" JSONB,
    "invocationsTotal" INTEGER NOT NULL DEFAULT 0,
    "invocationsMonth" INTEGER NOT NULL DEFAULT 0,
    "avgDurationMs" DOUBLE PRECISION,
    "lastInvoked" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServerlessFunction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagedDatabase" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "engine" "DbEngine" NOT NULL DEFAULT 'POSTGRESQL',
    "version" TEXT,
    "status" "DbStatus" NOT NULL DEFAULT 'CREATING',
    "size" "DbSize" NOT NULL DEFAULT 'SMALL',
    "storageGb" INTEGER NOT NULL DEFAULT 20,
    "region" TEXT,
    "endpoint" TEXT,
    "port" INTEGER,
    "backupEnabled" BOOLEAN NOT NULL DEFAULT true,
    "backupRetentionDays" INTEGER NOT NULL DEFAULT 7,
    "highAvailability" BOOLEAN NOT NULL DEFAULT false,
    "connectionsCurrent" INTEGER NOT NULL DEFAULT 0,
    "connectionsMax" INTEGER,
    "cpuUsage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "memoryUsage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pricePerMonth" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedDatabase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeploymentConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domainId" TEXT,
    "hostingPlanId" TEXT,
    "k8sClusterId" TEXT,
    "functionIds" TEXT[],
    "databaseIds" TEXT[],
    "status" "DeploymentStatus" NOT NULL DEFAULT 'DRAFT',
    "autoDeploy" BOOLEAN NOT NULL DEFAULT false,
    "sslEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastDeployed" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeploymentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pipeline" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deploymentConfigId" TEXT NOT NULL,
    "deploymentTargets" JSONB,
    "triggerType" "PipelineTrigger" NOT NULL DEFAULT 'MANUAL',
    "triggerConfig" JSONB,
    "buildSteps" JSONB,
    "testConfig" JSONB,
    "rollbackConfig" JSONB,
    "status" "PipelineStatus" NOT NULL DEFAULT 'IDLE',
    "lastRun" TIMESTAMP(3),
    "lastDeploymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineRun" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "status" "PipelineRunStatus" NOT NULL DEFAULT 'BUILDING',
    "triggerBy" TEXT,
    "buildLogs" TEXT,
    "testResults" JSONB,
    "deploymentSnapshot" JSONB,
    "durationSeconds" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValuationReport" (
    "id" TEXT NOT NULL,
    "domainName" TEXT NOT NULL,
    "valuationData" JSONB,
    "advancedMetrics" JSONB,
    "shareToken" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValuationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'MEDIUM',
    "relatedId" TEXT,
    "actionUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domainExpiryInApp" BOOLEAN NOT NULL DEFAULT true,
    "domainExpiryEmail" BOOLEAN NOT NULL DEFAULT true,
    "auctionBidInApp" BOOLEAN NOT NULL DEFAULT true,
    "auctionBidEmail" BOOLEAN NOT NULL DEFAULT false,
    "brokerageUpdateInApp" BOOLEAN NOT NULL DEFAULT true,
    "brokerageUpdateEmail" BOOLEAN NOT NULL DEFAULT true,
    "deploymentFailureInApp" BOOLEAN NOT NULL DEFAULT true,
    "deploymentFailureEmail" BOOLEAN NOT NULL DEFAULT true,
    "alertTriggeredInApp" BOOLEAN NOT NULL DEFAULT true,
    "alertTriggeredEmail" BOOLEAN NOT NULL DEFAULT true,
    "emailDigestFrequency" "DigestFrequency" NOT NULL DEFAULT 'DAILY',

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serviceType" "AlertServiceType" NOT NULL,
    "serviceId" TEXT NOT NULL,
    "metric" "AlertMetric" NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "condition" "AlertCondition" NOT NULL DEFAULT 'ABOVE',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggered" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshToken_key" ON "Session"("refreshToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_refreshToken_idx" ON "Session"("refreshToken");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Domain_fullName_key" ON "Domain"("fullName");

-- CreateIndex
CREATE INDEX "Domain_userId_idx" ON "Domain"("userId");

-- CreateIndex
CREATE INDEX "Domain_fullName_idx" ON "Domain"("fullName");

-- CreateIndex
CREATE INDEX "Domain_status_idx" ON "Domain"("status");

-- CreateIndex
CREATE INDEX "Domain_expiryDate_idx" ON "Domain"("expiryDate");

-- CreateIndex
CREATE INDEX "DnsRecord_domainId_idx" ON "DnsRecord"("domainId");

-- CreateIndex
CREATE INDEX "HostingPlan_userId_idx" ON "HostingPlan"("userId");

-- CreateIndex
CREATE INDEX "HostingPlan_status_idx" ON "HostingPlan"("status");

-- CreateIndex
CREATE INDEX "CartItem_userId_idx" ON "CartItem"("userId");

-- CreateIndex
CREATE INDEX "DomainListing_sellerId_idx" ON "DomainListing"("sellerId");

-- CreateIndex
CREATE INDEX "DomainListing_status_idx" ON "DomainListing"("status");

-- CreateIndex
CREATE INDEX "DomainListing_auctionEndDate_idx" ON "DomainListing"("auctionEndDate");

-- CreateIndex
CREATE INDEX "DomainOffer_listingId_idx" ON "DomainOffer"("listingId");

-- CreateIndex
CREATE INDEX "DomainOffer_buyerId_idx" ON "DomainOffer"("buyerId");

-- CreateIndex
CREATE INDEX "DomainOffer_status_idx" ON "DomainOffer"("status");

-- CreateIndex
CREATE INDEX "SellerRating_sellerId_idx" ON "SellerRating"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "SellerRating_sellerId_buyerId_listingId_key" ON "SellerRating"("sellerId", "buyerId", "listingId");

-- CreateIndex
CREATE INDEX "BrokerageRequest_clientId_idx" ON "BrokerageRequest"("clientId");

-- CreateIndex
CREATE INDEX "BrokerageRequest_brokerId_idx" ON "BrokerageRequest"("brokerId");

-- CreateIndex
CREATE INDEX "BrokerageRequest_status_idx" ON "BrokerageRequest"("status");

-- CreateIndex
CREATE INDEX "BrokerageMessage_requestId_createdAt_idx" ON "BrokerageMessage"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "PipelineRun_pipelineId_createdAt_idx" ON "PipelineRun"("pipelineId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ValuationReport_shareToken_key" ON "ValuationReport"("shareToken");

-- CreateIndex
CREATE INDEX "ValuationReport_domainName_idx" ON "ValuationReport"("domainName");

-- CreateIndex
CREATE INDEX "ValuationReport_shareToken_idx" ON "ValuationReport"("shareToken");

-- CreateIndex
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE INDEX "Alert_userId_idx" ON "Alert"("userId");

-- CreateIndex
CREATE INDEX "Alert_serviceType_serviceId_idx" ON "Alert"("serviceType", "serviceId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DnsRecord" ADD CONSTRAINT "DnsRecord_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostingPlan" ADD CONSTRAINT "HostingPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainListing" ADD CONSTRAINT "DomainListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainOffer" ADD CONSTRAINT "DomainOffer_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "DomainListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainOffer" ADD CONSTRAINT "DomainOffer_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerRating" ADD CONSTRAINT "SellerRating_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerRating" ADD CONSTRAINT "SellerRating_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerageRequest" ADD CONSTRAINT "BrokerageRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerageRequest" ADD CONSTRAINT "BrokerageRequest_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerageMessage" ADD CONSTRAINT "BrokerageMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "BrokerageRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentConfig" ADD CONSTRAINT "DeploymentConfig_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentConfig" ADD CONSTRAINT "DeploymentConfig_hostingPlanId_fkey" FOREIGN KEY ("hostingPlanId") REFERENCES "HostingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentConfig" ADD CONSTRAINT "DeploymentConfig_k8sClusterId_fkey" FOREIGN KEY ("k8sClusterId") REFERENCES "KubernetesCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_deploymentConfigId_fkey" FOREIGN KEY ("deploymentConfigId") REFERENCES "DeploymentConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineRun" ADD CONSTRAINT "PipelineRun_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
