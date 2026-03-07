const express = require('express')
const router = express.Router()
const AuthController = require('../controllers/auth-controller')
const auth = require('../auth')

router.post('/register', AuthController.registerUser)
router.post('/login', AuthController.loginUser)
router.post('/logout', AuthController.logoutUser)
router.get('/loggedIn', AuthController.getLoggedIn)
router.put('/user', auth.verify, AuthController.updateUser);

module.exports = router
