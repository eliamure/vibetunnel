# VibeTunnel Security & Compliance Guide

## Overview

VibeTunnel is designed to be an enterprise-grade, audit-ready terminal access solution for VM fleets and Kubernetes clusters. This document outlines the security architecture, compliance features, and deployment best practices.

## Security Architecture

### Authentication & Authorization

#### Multi-Factor Authentication Support
- **SSH Key Authentication**: Challenge-response using Ed25519 cryptographic signatures
- **Password Authentication**: PAM-based system authentication with rate limiting
- **Tailscale Integration**: Identity-aware proxy authentication
- **Bearer Token Auth**: For HQ-to-remote server communication in fleet mode

#### Rate Limiting
- Authentication endpoints: 5 attempts per 15 minutes per IP
- Failed password attempts: 3 attempts per hour (strict rate limiting)
- API endpoints: 100 requests per minute per IP
- Configurable exemptions for localhost in development mode

#### Session Management
- JWT tokens with 24-hour expiry
- HS256 signature algorithm
- Automatic token validation on all authenticated endpoints
- Session tracking and lifecycle management

### Audit Logging

#### Comprehensive Audit Trail
All security-relevant events are logged in structured JSON format:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "severity": "INFO",
  "category": "AUTHENTICATION",
  "action": "LOGIN",
  "userId": "admin@example.com",
  "sourceIp": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "result": "SUCCESS",
  "message": "User authenticated successfully",
  "details": {"method": "ssh-key"}
}
```

#### Audit Event Categories
- **AUTHENTICATION**: Login, logout, token generation
- **AUTHORIZATION**: Access grants/denials, permission changes
- **SESSION**: Session start, end, command execution
- **CONFIGURATION**: Settings changes, policy updates
- **SECURITY**: Rate limit hits, suspicious activity, security events
- **SYSTEM**: Service start/stop, health status changes

#### Log Management
- **Location**: `~/.vibetunnel/audit.log`
- **Format**: Newline-delimited JSON (NDJSON)
- **Rotation**: Automatic rotation at 100MB per file
- **Retention**: Configurable, default 10 rotated files
- **Integration**: Syslog support (configurable)

### Input Validation & Sanitization

#### Request Validation
All API endpoints validate input using Zod schemas:
- Type validation
- Length constraints
- Pattern matching
- Sanitization of special characters

#### Protection Against
- SQL Injection (N/A - no SQL database)
- Command Injection (strict input sanitization)
- Path Traversal (normalized path handling)
- XSS Attacks (input sanitization, CSP headers)
- Buffer Overflow (length validation)

### Network Security

#### Transport Layer Security
- **Recommendation**: Deploy behind HTTPS reverse proxy (nginx, Traefik, etc.)
- **Tailscale**: Built-in WireGuard encryption for fleet access
- **WebSocket**: Supports compression with integrity checks

#### Security Headers
Helmet.js integration provides:
- Content-Security-Policy (configurable)
- X-Content-Type-Options: nosniff
- X-Frame-Options: SAMEORIGIN
- Strict-Transport-Security (when HTTPS)
- X-XSS-Protection

#### CORS Configuration
- Configurable origin whitelist
- Credentials support for authenticated requests
- Preflight request handling

## Compliance Features

### SOC 2 Type II Readiness

#### Security Principles Coverage

**CC6.1 - Logical and Physical Access Controls**
- ✅ Multi-factor authentication support
- ✅ SSH key-based authentication
- ✅ Rate limiting on authentication endpoints
- ✅ Session timeout enforcement
- ✅ Audit logging of all access attempts

**CC6.2 - System Operations**
- ✅ Health check endpoints for monitoring
- ✅ Metrics export (Prometheus-compatible)
- ✅ Structured logging with severity levels
- ✅ Configuration management with validation

**CC6.3 - Risk Mitigation**
- ✅ Input validation on all endpoints
- ✅ Rate limiting to prevent DoS
- ✅ Automatic log rotation
- ✅ Security event monitoring

**CC7.2 - System Monitoring**
- ✅ Real-time health status
- ✅ Performance metrics collection
- ✅ Audit trail for all operations
- ✅ Alert-ready event logging

### ISO 27001 Alignment

#### A.9 - Access Control
- Identity verification through SSH keys or PAM
- Session management with automatic timeout
- Access logging and monitoring
- Least privilege principle enforcement

#### A.12 - Operations Security
- Health monitoring and alerting
- Log management and retention
- Change management through configuration service
- Backup considerations (documented)

#### A.14 - System Acquisition, Development and Maintenance
- Input validation framework
- Secure coding practices
- Security testing integration
- Vulnerability management (CodeQL)

### GDPR Compliance Considerations

#### Data Minimization
- Only essential user data collected (username, IP, timestamps)
- No personal data retention beyond audit requirements
- Session data cleaned up on exit

#### Right to Erasure
- User sessions can be terminated
- Audit logs can be filtered/anonymized
- Configuration for data retention periods

#### Data Protection by Design
- Encryption in transit (when HTTPS configured)
- Access controls on all endpoints
- Audit logging for data access

## Deployment Best Practices

### Production Deployment Checklist

#### Pre-Deployment
- [ ] Configure JWT_SECRET environment variable with strong random key
- [ ] Set up HTTPS reverse proxy (nginx, Traefik, Cloudflare)
- [ ] Configure firewall rules (allow only necessary ports)
- [ ] Set up centralized log collection (ELK, Splunk, etc.)
- [ ] Configure Tailscale for secure fleet access (recommended)
- [ ] Review and customize rate limiting rules
- [ ] Set up monitoring and alerting (Prometheus + Grafana)
- [ ] Configure backup strategy for configuration and logs

#### Security Hardening
- [ ] Disable password authentication if SSH keys are sufficient
- [ ] Enable strict rate limiting on authentication endpoints
- [ ] Configure minimum audit log severity level
- [ ] Set up automated security scanning (CodeQL, Dependabot)
- [ ] Implement network segmentation (separate management network)
- [ ] Configure session timeout appropriately for your environment
- [ ] Review and restrict CORS origins
- [ ] Enable audit log rotation with appropriate retention

#### Kubernetes Deployment
- [ ] Use Kubernetes Secrets for sensitive configuration
- [ ] Configure Pod Security Standards (restricted)
- [ ] Set resource limits and requests
- [ ] Configure liveness and readiness probes
- [ ] Use Network Policies for pod-to-pod communication
- [ ] Enable audit logging to persistent volume
- [ ] Configure service mesh (Istio/Linkerd) for mTLS
- [ ] Set up horizontal pod autoscaling based on metrics

### Environment Variables

#### Required
- `JWT_SECRET`: Strong random key for JWT signing (min 64 bytes)

#### Recommended
- `PORT`: Server port (default: 4021)
- `NODE_ENV`: Set to 'production' for production deployments
- `VIBETUNNEL_CONTROL_DIR`: Directory for session data
- `LOG_LEVEL`: Logging verbosity (INFO, WARN, ERROR)

#### Optional Security
- `VIBETUNNEL_USERNAME`: Override username for password auth
- `VIBETUNNEL_PASSWORD`: Override password for password auth
- `ALLOWED_ORIGINS`: Comma-separated CORS origins
- `RATE_LIMIT_WINDOW`: Rate limit window in milliseconds
- `RATE_LIMIT_MAX`: Maximum requests per window

### Reverse Proxy Configuration

#### Nginx Example
```nginx
upstream vibetunnel {
    server localhost:4021;
}

server {
    listen 443 ssl http2;
    server_name terminal.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;

    location /api/auth {
        limit_req zone=auth burst=3 nodelay;
        proxy_pass http://vibetunnel;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://vibetunnel;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```

#### Traefik Example
```yaml
http:
  routers:
    vibetunnel:
      rule: "Host(`terminal.example.com`)"
      service: vibetunnel
      middlewares:
        - secure-headers
        - rate-limit
      tls:
        certResolver: letsencrypt

  middlewares:
    secure-headers:
      headers:
        sslRedirect: true
        stsSeconds: 31536000
        stsIncludeSubdomains: true
        contentTypeNosniff: true
        frameDeny: true

    rate-limit:
      rateLimit:
        average: 100
        burst: 50

  services:
    vibetunnel:
      loadBalancer:
        servers:
          - url: "http://localhost:4021"
```

### Monitoring & Alerting

#### Health Check Endpoints
- `/health` - Basic health check (200 if healthy)
- `/health/detailed` - Comprehensive system health
- `/health/live` - Kubernetes liveness probe
- `/health/ready` - Kubernetes readiness probe

#### Metrics Endpoints
- `/metrics` - Prometheus-compatible text format
- `/metrics/json` - JSON format metrics

#### Key Metrics to Monitor
- `vibetunnel_active_sessions` - Active terminal sessions
- `vibetunnel_auth_failures_total` - Failed authentication attempts
- `vibetunnel_rate_limit_hits_total` - Rate limit violations
- `vibetunnel_memory_rss_bytes` - Memory usage
- `vibetunnel_system_load_average` - CPU load

#### Alerting Rules (Prometheus)
```yaml
groups:
  - name: vibetunnel
    rules:
      - alert: HighAuthFailureRate
        expr: rate(vibetunnel_auth_failures_total[5m]) > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High authentication failure rate"

      - alert: ServiceUnhealthy
        expr: up{job="vibetunnel"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "VibeTunnel service is down"

      - alert: HighMemoryUsage
        expr: vibetunnel_memory_rss_bytes > 1000000000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage detected"
```

## Incident Response

### Security Event Response

#### High-Priority Events
1. **Multiple Failed Authentication Attempts**
   - Action: Review audit logs for source IP
   - Consider: Temporary IP block, user notification
   - Alert: Security team immediately

2. **Unusual Access Patterns**
   - Action: Investigate user activity in audit logs
   - Consider: Session termination, account review
   - Alert: Incident response team

3. **Service Unavailability**
   - Action: Check system health, resource usage
   - Consider: Restart service, scale resources
   - Alert: Operations team

#### Log Analysis Queries

**Failed Authentication Attempts**
```bash
cat ~/.vibetunnel/audit.log | jq 'select(.category == "AUTHENTICATION" and .result == "FAILURE")'
```

**Access Denials**
```bash
cat ~/.vibetunnel/audit.log | jq 'select(.result == "DENIED")'
```

**High-Severity Events**
```bash
cat ~/.vibetunnel/audit.log | jq 'select(.severity == "ERROR" or .severity == "CRITICAL")'
```

**Activity by User**
```bash
cat ~/.vibetunnel/audit.log | jq 'select(.userId == "user@example.com")'
```

### Backup & Recovery

#### What to Backup
- Configuration files: `~/.vibetunnel/config.yaml`
- Audit logs: `~/.vibetunnel/audit.log*`
- Application logs: `~/.vibetunnel/log.txt`
- SSH keys (if managed by VibeTunnel)

#### Backup Strategy
- **Frequency**: Daily for logs, immediate for configuration changes
- **Retention**: 30 days for audit logs (adjust per compliance requirements)
- **Location**: Off-server, encrypted storage
- **Testing**: Monthly restore testing

## Security Updates

### Dependency Management
- Automated security scanning via GitHub Dependabot
- CodeQL analysis on every commit
- Regular dependency updates
- Vulnerability patching within 7 days of disclosure

### Update Process
1. Review security advisories
2. Test updates in staging environment
3. Schedule maintenance window
4. Apply updates
5. Verify functionality
6. Monitor for issues

## Compliance Audit Support

### Documentation Provided
- ✅ Security architecture documentation
- ✅ Data flow diagrams (this document)
- ✅ Access control policies
- ✅ Audit logging specifications
- ✅ Incident response procedures
- ✅ Backup and recovery procedures

### Audit Trail Access
Audit logs are structured for easy parsing and analysis:
- Filter by date range, user, action, or severity
- Export to CSV or JSON for compliance tools
- Integration with SIEM systems
- Tamper-evident (file integrity monitoring recommended)

### Compliance Reports
Generate compliance reports from audit logs:
```bash
# Authentication report
cat ~/.vibetunnel/audit.log | jq 'select(.category == "AUTHENTICATION")' | jq -s 'group_by(.result) | map({result: .[0].result, count: length})'

# Session activity report
cat ~/.vibetunnel/audit.log | jq 'select(.category == "SESSION")' | jq -s 'group_by(.userId) | map({user: .[0].userId, sessions: length})'

# Security events report
cat ~/.vibetunnel/audit.log | jq 'select(.category == "SECURITY")' | jq -s '.'
```

## Contact & Support

For security issues or compliance questions:
- Email: security@vibetunnel.dev (update with your contact)
- Report vulnerabilities: GitHub Security Advisories
- Documentation: https://github.com/eliamure/vibetunnel/docs

## Version History

- **1.0.0-beta.16+**: Added comprehensive audit logging, rate limiting, input validation
- **1.0.0-beta.16**: Initial production-ready release
