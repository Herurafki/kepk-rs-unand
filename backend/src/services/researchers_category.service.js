// services/researcher-category.service.js

const categoryModel =
  require('../models/researchers_category.model');

const getAll = async () => {
  return await categoryModel.findAll();
};

module.exports = {
  getAll,
};