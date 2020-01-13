mkdir dist
docker build -t gitlab-ldap-group-sync .
docker save gitlab-ldap-group-sync -o ./dist/gitlab-ldap-group-sync.tar
copy .\src\service\* dist
