const express = require('express');
const { registerUser, loginUser } = require('../controllers/authController');
const upload = require('../middleware/uploadMiddleware');
const router = express.Router();

// Configure Upload Fields based on your frontend keys
const uploadFields = upload.fields([
    { name: 'profilePic', maxCount: 1 },
    { name: 'fssaiDoc', maxCount: 1 },
    { name: 'gstDoc', maxCount: 1 }
]);

router.post('/register', uploadFields, registerUser);
router.post('/login', loginUser);

module.exports = router;