# VibeTunnel Kubernetes Deployment

This directory contains Kubernetes manifests for deploying VibeTunnel in a production-ready, secure configuration.

## Security Checklist

- [ ] JWT_SECRET is randomly generated and secure
- [ ] NetworkPolicy is applied and tested
- [ ] Pod Security Standards are enforced (restricted)
- [ ] Resource limits are configured
- [ ] TLS is enabled on Ingress
- [ ] Audit logging is enabled
- [ ] Monitoring is configured
- [ ] Backup strategy is in place
- [ ] Access controls (RBAC) are configured
- [ ] Secrets are rotated regularly
