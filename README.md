# gitlab-ldap-group-sync
It provides a way to sync ldap group members with gitlab groups
Based on https://github/pisamad/gitlab-ldap-group-sync

## Prerequisites
Node JS or docker

## Installation
### Without docker
Clone the repository and create a `config.json` file.

```bash
git clone https://github.com/gitlab-tools/gitlab-ldap-group-sync.git
cd gitlab-ldap-group-sync
cp config.sample.json config.json
npm install
```

### With docker
- Create a Docker image with build.cmd.
- Load gitlab-ldap-group-sync docker image
  ```bash
  docker load -i ~/gitlab-ldap-group-sync/dist/gitlab-ldap-group-sync.tar
  ```
- Install & start service to launch gitlab-ldap-group-sync
```bash
mkdir -p /opt/gitlab_ldap_group_sync/config
cp ~/gitlab-ldap-group-sync/dist/gitlab-ldap-group-sync /opt/gitlab_ldap_group_sync/
chmod +x /opt/gitlab_ldap_group_sync/gitlab-ldap-group-sync
cp ~/gitlab-ldap-group-sync/dist/gitlab-ldap-group-sync/config/config.json /opt/gitlab_ldap_group_sync/config.json
```
## Configuration
See: [config.sample.json ](config.sample.json )
```
  {
    "port": 80,
    "syncInterval": "10m",
    "gitlab": {
      "api": "https://gitlab.securite.local/api/v4",
      "privateToken": "***" --> Gitlab token with scopes "api,sudo"
    },
    "ldap": {
      "url": "ldap://sl1chxrddc01.securite.local",
      "baseDN": "DC=securite,DC=local", --> OU from to look for gitlab-* group
      "username": "s-gitlab@securite.local",
      "password": "***" --> See safe
    },
    "ldapGroupPrefix": "gitlab-"
  }
```

## Activate as service (with docker)
```bash
cp ~/gitlab-ldap-group-sync/dist/gitlab-ldap-group-sync.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable gitlab-ldap-group-sync
systemctl start gitlab-ldap-group-sync
```

## Gitlab hook 
Add gitlab hook (need gitlab admin account)
URL : http://localhost:8000/api/gitlab/webhook
Secret Token : <keep empty>
Trigger : 
Repository update events
Create ldap groups
Create gitlab-* groups
Test :
Synchro is scheduled each 10mn (see config.json)
Synchro can be forced via the url : http://gitlab:8000/api/gitlab/doSync
