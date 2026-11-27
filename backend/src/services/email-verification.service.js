'use strict';
const crypto = require('crypto');
const pool = require('../config/database');
const nodemailer = require('nodemailer');
const TTL = 30;
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const esc = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const transporter = () => {
 const {SMTP_HOST,SMTP_PORT,SMTP_USER,SMTP_PASS}=process.env;
 if(!SMTP_HOST||!SMTP_PORT||!SMTP_USER||!SMTP_PASS){const e=new Error('SMTP belum dikonfigurasi.');e.statusCode=503;throw e;}
 return nodemailer.createTransport({host:SMTP_HOST,port:Number(SMTP_PORT),secure:String(process.env.SMTP_SECURE).toLowerCase()==='true',auth:{user:SMTP_USER,pass:SMTP_PASS}});
};
const sendVerificationEmail = async userId => {
 const mailer=transporter(), base=String(process.env.FRONTEND_URL||'').replace(/\/$/,'');
 if(!base){const e=new Error('FRONTEND_URL belum dikonfigurasi.');e.statusCode=503;throw e;}
 const q=await pool.query("SELECT u.id,u.name,u.email,u.email_verified FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.id=$1 AND r.name='PENELITI' LIMIT 1",[userId]);
 const user=q.rows[0]; if(!user||user.email_verified)return {sent:false};
 const raw=crypto.randomBytes(32).toString('hex'), hash=sha(raw), expiry=new Date(Date.now()+TTL*60000);
 const c=await pool.connect(); try {await c.query('BEGIN');await c.query('UPDATE email_verification_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL',[user.id]);await c.query('INSERT INTO email_verification_tokens(user_id,token_hash,expires_at) VALUES($1,$2,$3)',[user.id,hash,expiry]);await c.query('COMMIT');} catch(e){await c.query('ROLLBACK');throw e;} finally{c.release();}
 const url=base+'/verify-email?token='+encodeURIComponent(raw);
 try {await mailer.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to:user.email,subject:'Verifikasi Email Akun Peneliti KEPK',text:'Halo '+user.name+', buka tautan berikut dalam '+TTL+' menit: '+url,html:'<p>Halo '+esc(user.name)+',</p><p>Verifikasi alamat email Anda untuk mengaktifkan akun Peneliti KEPK.</p><p><a href="'+url+'">Verifikasi Email</a></p><p>Tautan berlaku '+TTL+' menit dan hanya dapat digunakan satu kali.</p>'});}
 catch(e){await pool.query('UPDATE email_verification_tokens SET used_at=NOW() WHERE token_hash=$1 AND used_at IS NULL',[hash]);throw e;}
 return {sent:true};
};
const verifyEmail=async raw=>{if(!raw||typeof raw!=='string'){const e=new Error('Tautan verifikasi tidak valid atau kedaluwarsa.');e.statusCode=400;throw e;}const c=await pool.connect();try{await c.query('BEGIN');const q=await c.query('SELECT id,user_id FROM email_verification_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at>NOW() FOR UPDATE',[sha(raw)]);const t=q.rows[0];if(!t){const e=new Error('Tautan verifikasi tidak valid atau kedaluwarsa.');e.statusCode=400;throw e;}await c.query('UPDATE users SET email_verified=TRUE,email_verified_at=NOW(),updated_at=NOW() WHERE id=$1',[t.user_id]);await c.query('UPDATE email_verification_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL',[t.user_id]);await c.query('COMMIT');return {verified:true,message:'Email berhasil diverifikasi. Silakan login.'};}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}};
const resendVerification=async email=>{const normalized=String(email||'').trim().toLowerCase();if(!normalized){const e=new Error('Email wajib diisi.');e.statusCode=400;throw e;}const q=await pool.query("SELECT u.id,u.email_verified FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE LOWER(u.email)=$1 AND r.name='PENELITI' LIMIT 1",[normalized]);const user=q.rows[0],message='Jika akun Peneliti dengan email tersebut belum terverifikasi, tautan verifikasi akan dikirim.';if(!user||user.email_verified)return {message,sent:false};const recent=await pool.query("SELECT 1 FROM email_verification_tokens WHERE user_id=$1 AND created_at>NOW()-INTERVAL '60 seconds' LIMIT 1",[user.id]);if(recent.rowCount)return {message:'Tautan baru saja dikirim. Coba lagi setelah 1 menit.',sent:false};await sendVerificationEmail(user.id);return {message,sent:true};};
module.exports={sendVerificationEmail,verifyEmail,resendVerification};
