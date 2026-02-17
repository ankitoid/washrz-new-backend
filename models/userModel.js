import crypto from "crypto";
import mongoose from "mongoose";
import validator from "validator";
import bcrypt from "bcryptjs";

// const phoneSchema = new mongoose.Schema({
//   type: String,
// });

// phoneSchema.path("type").validate(function (value) {
//   const phoneRegex = /^(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}$/;
//   return phoneRegex.test(value);
// }, "Enter a valid phone number");

const minimumLimit = function (val) {
  return val.length >= 1;
};

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please tell us your name!"],
  },
  email: {
    type: String,
    required: [true, "Please provide your email"],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, "Please provide a valid email"],
  },
  avatar: {
    type: String,
    default: "default.jpg",
  },
  phone: {
    type: String,
    index: true,
    unique: true,
    validate: [minimumLimit, "Enter at least one phone number"],
  },
  role: {
    type: String,
    enum: ["customer", "admin", "rider", "plant-manager"],
    default: "admin",
  },
  plant: {
    type: String,
    required: [true, "Please Select your plant"],
  },

  totalKm: {
    type: Number,
    default: 0,
  },
  lastResetAt: {
    type: Date,
    default: null,
  },

  password: {
    type: String,
    required: [true, "Please provide a password"],
    minlength: 8,
    select: false,
  },
  passwordConfirm: {
    type: String,
    required: [true, "Please confirm your password"],
    validate: {
      validator: function (el) {
        return el === this.password;
      },
      message: "Passwords are not the same!",
    },
  },
  addharCardNo: {
    type: Number,
    required: [true, "Addhar card no, can not be more than or less 16 digit"],
    minlength: 16,
    maxlength: 16,
    select: false,
  },
  drivingLicence: {
    type: String,
    select: false,
  },
  refreshToken: String,
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
});

userSchema.pre("save", async function (next) {
  console.log("i am in block 1");
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 12);
  this.passwordConfirm = undefined;
  next();
});

userSchema.pre("save", function (next) {
  console.log("i am in block 2");
  if (!this.isModified("password") || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000;
  next();
});

userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }

  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

const User = mongoose.model("users", userSchema);

export default User;
