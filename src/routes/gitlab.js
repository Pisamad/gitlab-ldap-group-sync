const express = require('express')
const router = express.Router()

/* Gitlab event post hook. */
router.post('/webhook', function (req, res) {
  console.log('Event : ', req.body.event_name)
  if (req.body.event_name === 'user_create') {
    gitlabLdapGroupSync.sync()
    res.status(200).send('OK')
  } else {
    res.status(422).send('This is not a valid gitlab system hook')
  }
})

/* Do sync */
router.get('/dosync', function (req, res) {
  console.log('Do sync requested')
  gitlabLdapGroupSync.sync()
  res.status(200).send('OK')
})

module.exports = router

let gitlabLdapGroupSync = undefined
module.exports.init = function (glgs) {
  gitlabLdapGroupSync = glgs
}
