// controllers/researcher-category.controller.js

const categoryService =
  require('../services/researchers_category.service');

const getAll = async (req, res, next) => {
  try {
    const categories =
      await categoryService.getAll();

    return res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAll,
};