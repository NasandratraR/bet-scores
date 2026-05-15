const router = require('express').Router();

router.use('/leagues', require('./leagues'));
router.use('/',        require('./teams'));
router.use('/',        require('./matches'));

module.exports = router;
