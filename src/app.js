// Read config
const configSchema = require('./config/config.schema')
const validate = require('jsonschema').validate
const getenv = require('getenv')

let config = {}
try {
  config = require('./config/config')
} catch (err) {
  console.log('no config file found')
}

readEnvironmentVariables(configSchema, config)

let result = validate(config, configSchema)
if (result.errors.length > 0) {
  console.log('Config file invalid', result)
  process.exit(1)
}

let gitlabLdapGroupSync = new require('./actions/gitlabLdapGroupSync')(config)
gitlabLdapGroupSync.startScheduler(config.syncInterval || '1h')
gitlabLdapGroupSync.sync()

/// EXPRESS
const express = require('express')
const bodyParser = require('body-parser')
const logger = require('morgan')
const routes = require('./routes/index')
const gitlabRoute = require('./routes/gitlab')

gitlabRoute.init(gitlabLdapGroupSync)

let app = express()
app.set('port', config.port || process.env.PORT || 8080)

app.use(logger('dev'))

app.use(bodyParser.json())

app.use('/', routes)
app.use('/api/gitlab', gitlabRoute)

/// catch 404 and forward to error handler
app.use(function (req, res, next) {
  let err = new Error('Not Found')
  err.status = 404
  next(err)
})


module.exports = app


// Helper functions
function readEnvironmentVariables(schema, conf, prefix = '') {
  getenv.enableErrors()
  for (property in schema.properties) {
    let envKey = (prefix + property).toUpperCase().replace('.', '_')
    try {
      if (schema.properties[property].type === 'object') {
        let subConf = conf[property] || {}
        conf[property] = subConf
        readEnvironmentVariables(schema.properties[property], subConf, prefix + property + '.')
      } else if (schema.properties[property].type === 'string') {
        conf[property] = getenv(envKey)
      } else if (schema.properties[property].type === 'integer') {
        conf[property] = getenv.int(envKey)
      } else {
        console.log('unsupported type', schema.properties[property].type)
      }
    } catch (e) { }
  }
}
