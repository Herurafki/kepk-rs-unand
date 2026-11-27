'use strict';
const chiefAssignmentService = require('../services/chief-assignment.service');
const { success, validationError } = require('../utils/response');
const assign = async (req,res,next)=>{try{const {application_id,reviewer_id,review_type}=req.body;const errors={};if(!application_id)errors.application_id='application_id is required';if(!reviewer_id)errors.reviewer_id='reviewer_id is required';if(!review_type)errors.review_type='review_type is required';if(Object.keys(errors).length)return validationError(res,errors);return success(res,await chiefAssignmentService.assign(application_id,reviewer_id,req.user.id,review_type),'Reviewer assigned',201)}catch(err){next(err)}};
module.exports={assign};
