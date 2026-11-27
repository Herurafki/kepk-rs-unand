'use strict';
const userService = require('../services/user.service');
const { success, validationError } = require('../utils/response');

const list = async (req, res, next) => { try { return success(res, await userService.list(), 'Users retrieved'); } catch (err) { next(err); } };
const listReviewers = async (req, res, next) => { try { return success(res, await userService.listReviewers(), 'Reviewers retrieved'); } catch (err) { next(err); } };
const getReviewerProfile = async (req, res, next) => { try { return success(res, await userService.getReviewerProfile(req.user.id), 'Reviewer profile retrieved'); } catch (err) { next(err); } };
const updateReviewerProfile = async (req, res, next) => { try { return success(res, await userService.updateReviewerProfile(req.user.id, req.body), 'Reviewer profile updated'); } catch (err) { next(err); } };
const setReviewerActiveStatus = async (req, res, next) => {
  try {
    const { is_active: isActive } = req.body || {};
    if (typeof isActive !== 'boolean') return validationError(res, { is_active: 'is_active harus berupa boolean' });
    const user = await userService.setReviewerActiveStatus(req.params.id, isActive, req.user.id);
    return success(res, user, isActive ? 'Reviewer activated' : 'Reviewer deactivated');
  } catch (err) { next(err); }
};
const updateReviewerManagement = async (req, res, next) => { try { return success(res, await userService.updateReviewerManagement(req.params.id, req.body), 'Reviewer updated'); } catch (err) { next(err); } };
const getById = async (req, res, next) => { try { return success(res, await userService.getById(req.params.id), 'User retrieved'); } catch (err) { next(err); } };

const create = async (req, res, next) => {
  try {
    const { name, email, password, role, specialization, position } = req.body;
    const errors = {};
    if (!name) errors.name = 'Name is required';
    if (!email) errors.email = 'Email is required';
    if (!password) errors.password = 'Password is required';
    if (!role) errors.role = 'Role is required';
    if (Object.keys(errors).length > 0) return validationError(res, errors);
    return success(res, await userService.create({ name, email, password, role, specialization, position }, req.user.roles), 'User created', 201);
  } catch (err) { next(err); }
};

const update = async (req, res, next) => { try { return success(res, await userService.update(req.params.id, req.body), 'User updated'); } catch (err) { next(err); } };
const setActiveStatus = async (req, res, next) => {
  try {
    const { is_active: isActive } = req.body || {};
    if (typeof isActive !== 'boolean') {
      return validationError(res, { is_active: 'is_active harus berupa boolean' });
    }
    const user = await userService.setActiveStatus(req.params.id, isActive, req.user.id);
    return success(res, user, isActive ? 'User activated' : 'User deactivated');
  } catch (err) { next(err); }
};
const assignRole = async (req, res, next) => { try { const { roleId } = req.body; if (!roleId) return validationError(res, { roleId: 'roleId is required' }); return success(res, await userService.assignRole(req.params.id, roleId), 'Role assigned'); } catch (err) { next(err); } };
const removeRole = async (req, res, next) => { try { await userService.removeRole(req.params.id, req.params.roleId); return success(res, null, 'Role removed'); } catch (err) { next(err); } };
const getResearcherProfile = async (req, res, next) => { try { return success(res, await userService.getResearcherProfile(req.params.id || req.user.id), 'Researcher profile retrieved'); } catch (err) { next(err); } };
const updateResearcherProfile = async (req, res, next) => { try { return success(res, await userService.updateResearcherProfile(req.user.id, req.body), 'Researcher profile updated'); } catch (err) { next(err); } };

const updatePassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ success: false, message: 'Password wajib diisi' });
    if (password.length < 8) return res.status(400).json({ success: false, message: 'Password minimal 8 karakter' });
    const user = await userService.updatePassword(req.params.id, password);
    if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    return res.status(200).json({ success: true, message: 'Password berhasil diubah', data: user });
  } catch (error) { next(error); }
};

const getAllRoles = async (req, res, next) => {
  try { return res.status(200).json({ success: true, data: await userService.getAllRoles() }); }
  catch (err) { next(err); }
};

module.exports = { list, listReviewers, getReviewerProfile, updateReviewerProfile, updateReviewerManagement, setReviewerActiveStatus, getById, create, update, setActiveStatus, assignRole, removeRole, getResearcherProfile, updateResearcherProfile, updatePassword, getAllRoles };
