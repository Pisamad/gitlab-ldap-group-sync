const co = require('co')
const every = require('schedule').every
const ActiveDirectory = require('activedirectory')
const NodeGitlab = require('node-gitlab')
const logger = require('logger').createLogger('./log/gitlabLdapGroupSync.log')
logger.format = function (level, date, message) {
  return date.toISOString() + ' - ' + level + ' - ' + message
}

module.exports = GitlabLdapGroupSync

let isRunning = false
let gitlab = undefined
let ldap = undefined
let ldapGroupPrefix = undefined

function GitlabLdapGroupSync(config) {
  if (!(this instanceof GitlabLdapGroupSync))
    return new GitlabLdapGroupSync(config)

  ldapGroupPrefix = config.ldapGroupPrefix || 'gitlab-'
  gitlab = NodeGitlab.createThunk(config.gitlab)
  ldap = new ActiveDirectory(config.ldap)

}

GitlabLdapGroupSync.prototype.sync = function () {
  if (isRunning) {
    console.log('ignore trigger, a sync is already running')
    return
  }
  isRunning = true

  co(function* () {
    // find all users with a ldap identiy
    let gitlabUsers = []
    let pagedUsers = []
    let i = 0
    do {
      i++
      pagedUsers = yield gitlab.users.list({ per_page: 100, page: i })
      gitlabUsers.push.apply(gitlabUsers, pagedUsers)
    } while (pagedUsers.length == 100)

    let gitlabUserMap = {}
    let gitlabLocalUserIds = []
    for (let user of gitlabUsers) {
      if (user.identities.length > 0) {
        // gitlabUserMap[user.identities[0].extern_uid] = user.id
        gitlabUserMap[user.username.toLowerCase()] = user.id
      } else {
        gitlabLocalUserIds.push(user.id)
      }
    }
    console.log('Remote GitLab users : ', gitlabUserMap)
    console.log('Local  GitLab users : ', gitlabLocalUserIds)

    //get all ldap groups and create a map with gitlab userid;
    let ldapGroups = yield getAllLdapGroups(ldap)
    let grpMembers = {}
    for (let ldapGroup of ldapGroups) {
      grpMembers[ldapGroup.cn.replace(ldapGroupPrefix, '')] = yield resolveLdapGroupMembers(ldap, ldapGroup, gitlabUserMap)
    }
    console.log('Group Members : ', grpMembers)

    //set the gitlab group members based on ldap group
    let gitlabGroups = []
    let pagedGroups = []
    i = 0
    do {
      i++
      pagedGroups = yield gitlab.groups.list({ per_page: 100, page: i })
      gitlabGroups.push.apply(gitlabGroups, pagedGroups)
    } while (pagedGroups.length == 100)

    for (let gitlabGroup of gitlabGroups) {
      console.log('-------------------------')
      console.log('group:', gitlabGroup.name)
      let gitlabGroupMembers = []
      let pagedGroupMembers = []
      let i = 0
      do {
        i++
        pagedGroupMembers = yield gitlab.groupMembers.list({ id: gitlabGroup.id, per_page: 100, page: i })
        gitlabGroupMembers.push.apply(gitlabGroupMembers, pagedGroupMembers)
      } while (pagedGroupMembers.length == 100)

      let currentMemberIds = []
      for (let member of gitlabGroupMembers) {
        if (gitlabLocalUserIds.indexOf(member.id) > -1) {
          continue //ignore local users
        }

        let access_level = accessLevel(gitlabGroup.id, grpMembers)
        if (member.access_level !== access_level) {
          logger.info('update group member permission', { id: gitlabGroup.id, user_id: member.id, access_level: access_level })
          gitlab.groupMembers.update({ id: gitlabGroup.id, user_id: member.id, access_level: access_level })
        }

        currentMemberIds.push(member.id)
      }

      let members = grpMembers[gitlabGroup.name] || grpMembers[gitlabGroup.path] || grpMembers['default'] || []

      //remove unlisted users
      let toDeleteIds = currentMemberIds.filter(x => members.indexOf(x) == -1)
      for (let id of toDeleteIds) {
        logger.info('delete group member', { id: gitlabGroup.id, user_id: id })
        gitlab.groupMembers.remove({ id: gitlabGroup.id, user_id: id })
      }

      //add new users
      let toAddIds = members.filter(x => currentMemberIds.indexOf(x) == -1)
      for (let id of toAddIds) {
        let access_level = accessLevel(gitlabGroup.id, grpMembers)
        logger.info('add group member', { id: gitlabGroup.id, user_id: id, access_level: access_level })
        gitlab.groupMembers.create({ id: gitlabGroup.id, user_id: id, access_level: access_level })
      }

      // Suppress treated ldap group
      delete grpMembers[gitlabGroup.name]
    }

    // Create reminder group in LDAP
    for (let groupName in grpMembers) {
      logger.info('add group : ', groupName)
      let newgitlabGroup = yield gitlab.groups.create({ name: groupName, path: groupName, visibility: 'private' })
      for (let id of grpMembers[groupName]) {
        let access_level = accessLevel(newgitlabGroup.id, grpMembers)
        logger.info('add group member', { id: newgitlabGroup.id, user_id: id, access_level: access_level })
        gitlab.groupMembers.create({ id: newgitlabGroup.id, user_id: id, access_level: access_level })
      }
    }

  }).then(function (value) {
    console.log('sync done')
    isRunning = false
  }, function (err) {
    console.error(err.stack)
  })
}

let ins = undefined

GitlabLdapGroupSync.prototype.startScheduler = function (interval) {
  this.stopScheduler()
  ins = every(interval).do(this.sync)
}

GitlabLdapGroupSync.prototype.stopScheduler = function () {
  if (ins) {
    ins.stop()
  }
  ins = undefined
}

function getAllLdapGroups(ldap) {
  return new Promise(function (resolve, reject) {
    ldap.findGroups('CN=' + ldapGroupPrefix + '*', function (err, groups) {
      if (err) {
        reject(err)
        return
      }
      resolve(groups)
    })
  })
}

function resolveLdapGroupMembers(ldap, group, gitlabUserMap) {
  return new Promise(function (resolve, reject) {
    ldap.getUsersForGroup(group.cn, function (err, users) {
      if (err) {
        reject(err)
        return
      }

      let members = []
      for (let user of users) {
        let sAMAccountName = user.sAMAccountName.toLowerCase()
        if (gitlabUserMap[sAMAccountName]) {
          members.push(gitlabUserMap[sAMAccountName])
        }
      }
      resolve(members)
    })
  })
}

function accessLevel(id, grpMembers) {
  if (grpMembers['admins'] === undefined) {
    return 40
  } else {
    return grpMembers['admins'].indexOf(id) > -1 ? 40 : 30
  }
}
