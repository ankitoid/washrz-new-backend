import crypto from "crypto";
import { promisify } from "util";
import jwt from "jsonwebtoken";
import catchAsync from "../utills/catchAsync.js";
import AppError from "../utills/appError.js";
import User from "../models/userModel.js";
import Order from "../models/orderSchema.js";
import AWS from "aws-sdk";
import multer from "multer";
import Pickup from "../models/pickupSchema.js";

const signAccToken = (id, type) => {
  return jwt.sign({ id, userType: type }, process.env.JWT_SECRET, {
    expiresIn: process.env.ACC_JWT_EXPIRES_IN,
  });
};

const signRefToken = (id, type) => {
  return jwt.sign({ id, userType: type }, process.env.JWT_SECRET, {
    expiresIn: process.env.REF_JWT_EXPIRES_IN,
  });
};

// const createSendToken = async (user, type, statusCode, req, res) => {
//   const accessToken = signAccToken(user._id, type);
//   const refreshToken = signRefToken(user._id, type);

//   // res.cookie('jwt', token, {
//   //   expires: new Date(
//   //     Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
//   //   ),
//   //   httpOnly: true,
//   //   secure: req.secure || req.headers['x-forwarded-proto'] === 'https'
//   // });

//   // Saving refreshToken with current user
//   user.refreshToken = refreshToken;
//   user.passwordConfirm = user.password;
//   const result = await user.save();
//   // console.log("==========================>>user.refreshToken", user.refreshToken);

//   // Creates Secure Cookie with refresh token
//   res.cookie("jwt", refreshToken, {
//     httpOnly: true,
//     secure: true,
//     sameSite: "None",
//     maxAge: 24 * 60 * 60 * 1000,
//   });

//   // Remove password from output
//   user.password = undefined;

//   res.status(statusCode).json({
//     status: "success",
//     tokens: { accessToken, refreshToken },
//     data: {
//       user,
//     },
//   });
// };

const createSendToken = async (user, type, statusCode, req, res) => {
  try {
    const accessToken = signAccToken(user._id, type);
    const refreshToken = signRefToken(user._id, type);

    user.refreshToken = refreshToken;
    user.passwordConfirm = user.password;
    await user.save();

    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 24 * 60 * 60 * 1000,
    });

    user.password = undefined;

    res.status(statusCode).json({
      status: "success",
      tokens: { accessToken, refreshToken },
      data: {
        user,
      },
    });
  } catch (error) {
    res.status(500).json({ status: "fail", message: error.message });
  }
};

export const signup = catchAsync(async (req, res, next) => {
  const {
    photo,
    fullName,
    mobileNumber,
    email,
    role,
    plant,
    aadhaarCard,
    drivingLicence,
    password,
    confirmPassword,
  } = req.body;

  console.log("==============================================>> ", req.body);

  const newUser = await User.create({
    name: fullName,
    email,
    password,
    passwordConfirm: confirmPassword,
    phone: mobileNumber,
    role,
    plant,
    avatar: "",
    addharCardNo: aadhaarCard,
    drivingLicence,
  });

  // const url = `${req.protocol}://${req.get("host")}/me`;
  // console.log(url);
  // await new Email(newUser, url).sendWelcome();

  createSendToken(newUser, newUser.role, 201, req, res);
});

export const login = catchAsync(async (req, res, next) => {
  console.log("i am in login----------");
  const { email, password } = req.body;
  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError("Please provide email and password!", 400));
  }
  // 2) Check if user exists && password is correct
  const user = await User.findOne({ email }).select("+password").exec();
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("Incorrect email or password", 401));
  }

  // 3) If everything ok, send token to client
  createSendToken(user, user.role, 200, req, res);
});

export const logoutUser = (req, res) => {
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.clearCookie("token");
  res.status(200).json({ status: "successfully logout" });
};

export const protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check of it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }
  if (!token) {
    return next(
      new AppError("You are not logged in! Please log in to get access.", 401)
    );
  }

  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  console.log("here is the decoded data ------>>> ", decoded);

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError(
        "The user belonging to this token does no longer exist.",
        401
      )
    );
  }

  // 4) Check if user changed password after the token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError("User recently changed password! Please log in again.", 401)
    );
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

// Only for rendered pages, no errors!
export const isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      // 1) verify token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );

      // 2) Check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }

      // 3) Check if user changed password after the token was issued
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }

      // THERE IS A LOGGED IN USER
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
};

export const restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles ['admin', 'lead-guide']. role='user'
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403)
      );
    }

    next();
  };
};

export const forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError("There is no user with email address.", 404));
  }

  // 2) Generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // 3) Send it to user's email
  try {
    const resetURL = `${req.protocol}://${req.get(
      "host"
    )}/api/v1/users/resetPassword/${resetToken}`;
    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: "success",
      message: "Token sent to email!",
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError("There was an error sending the email. Try again later!"),
      500
    );
  }
});

export const resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError("Token is invalid or has expired", 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // 3) Update changedPasswordAt property for the user
  // 4) Log the user in, send JWT
  createSendToken(user, 200, req, res);
});

export const updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user.id).select("+password");

  // 2) Check if POSTed current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError("Your current password is wrong.", 401));
  }

  // 3) If so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  // User.findByIdAndUpdate will NOT work as intended!

  // 4) Log user in, send JWT
  createSendToken(user, 200, req, res);
});

export const refreshToken = catchAsync(async (req, res, next) => {
  const cookies = req.cookies;
  console.log("this is the ", cookies);
  if (!cookies.jwt) return res.sendStatus(401);
  const refreshToken = cookies.jwt;

  const foundUser = await User.findOne({ refreshToken });
  if (!foundUser) return res.sendStatus(403); //Forbidden

  // evaluate jwt
  jwt.verify(refreshToken, process.env.JWT_SECRET, (err, decoded) => {
    if (err || foundUser._id.toString() !== decoded.id)
      return res.sendStatus(403);
    // const roles = Object.values(foundUser.role);
    const accessToken = signAccToken(decoded.id, decoded.userType);
    res.json({ role: decoded.role, accessToken, user: foundUser });
  });
});

//users api
// Get all users
export const getAllUsers = catchAsync(async (req, res, next) => {
  const users = await User.find(); // Fetch all users from the database
  res.status(200).json({
    status: "success",
    results: users.length,
    data: {
      users,
    },
  });
});

export const getplantusers = catchAsync(async (req, res, next) => {
  // Retrieve the `plant` query parameter from the request URL
  const { plant } = req.query;

  // Use the `plant` query parameter to filter users if provided
  const filter = plant ? { plant } : {};

  // Fetch all users matching the filter (or all users if no filter is applied)
  const users = await User.find(filter);

  res.status(200).json({
    status: "success",
    results: users.length,
    data: {
      users,
    },
  });
});

// Delete a user
export const deleteUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const user = await User.findByIdAndDelete(id); // Find and delete the user by ID

  if (!user) {
    return res.status(404).json({
      status: "fail",
      message: "User not found",
    });
  }

  res.status(204).json({
    status: "success",
    message: "User deleted successfully",
    data: null,
  });
});

// Update order status
export const updateOrderStatus = async (req, res) => {
  const { status } = req.body;

  try {
    const orderId = req.params.id;

    // Ensure that both `orderId` and `status` are provided
    if (!orderId || !status) {
      return res
        .status(400)
        .json({ message: "Order ID and status are required." });
    }

    // Prepare the update object to update the status and the statusHistory
    const updateData = {
      status,
    };

    // Set the appropriate statusHistory field based on the status
    if (status === "intransit") {
      updateData["statusHistory.intransit"] = new Date();
    } else if (status === "processing") {
      updateData["statusHistory.processing"] = new Date();
    } else if (status === "ready for delivery") {
      updateData["statusHistory.readyForDelivery"] = new Date();
    } else if (status === "delivery rider assigned") {
      updateData["statusHistory.deliveryriderassigned"] = new Date();
    }else if (status === "delivered") {
      updateData["statusHistory.delivered"] = new Date();
    }

    // Update the order status and statusHistory in the database
    const updatedOrder = await Order.findByIdAndUpdate(orderId, updateData, {
      new: true,
    });

    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found." });
    }

    res
      .status(200)
      .json({ message: "Order status updated successfully.", updatedOrder });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// upload audio and voice
// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
  region: process.env.AWS_S3_REGION,
});

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fieldSize: 25 * 1024 * 1024 },
}).fields([
  { name: "image", maxCount: 10 }, // `image` should match frontend field name
  { name: "voice", maxCount: 1 }, // `voice` should match frontend field name
]);

// Function to upload files to S3
const uploadToS3 = (file, bucketName) => {
  const params = {
    Bucket: bucketName,
    Key: `beforeOrderImage/${Date.now()}_${file.originalname}`,
    Body: file.buffer,
    ContentType: file.mimetype,
  };
  return s3.upload(params).promise();
};

// Upload files and update order status
export const uploadFiles = (req, res, next) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: "Error uploading files.", err });
    }

    const { id } = req.params;
    const { image } = req.files;
    const voice = req.files?.voice || [];

    if (!id || !image) {
      return res
        .status(400)
        .json({ message: "Order ID, image, files are required." });
    }

    try {
      // Upload multiple images to S3
      const imageUploads = await Promise.all(
        image.map((img) => uploadToS3(img, process.env.AWS_S3_BUCKET_NAME))
      );
      const imageUrls = imageUploads.map((upload) => upload.Location);

      // const voiceUpload = await uploadToS3(
      //   voice[0],
      //   process.env.AWS_S3_BUCKET_NAME
      // );

      // Upload voice to S3 if it exists
      let voiceUpload = null;
      if (voice.length > 0) {
        voiceUpload = await uploadToS3(
          voice[0],
          process.env.AWS_S3_BUCKET_NAME
        );
      }

      // Update order with S3 file URLs and change status to 'processing'
      const updatedOrder = await Order.findByIdAndUpdate(
        id,
        {
          image: imageUrls,
          voice: voiceUpload?.Location || null,
        },
        { new: true }
      );

      if (!updatedOrder) {
        return res.status(404).json({ message: "Order not found." });
      }

      res.status(200).json({
        message: "Files uploaded.",
        updatedOrder,
      });
    } catch (error) {
      console.error("Error uploading files or updating order:", error);
      res.status(500).json({ message: "Internal server error." });
    }
  });
};

export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

export const getPickupById = async (req, res) => {
  try {
    const pickup = await Pickup.findById(req.params.id);
    if (!pickup) {
      return res.status(404).json({ message: "Pickup not found" });
    }
    res.json(pickup);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// get photo and voice

export const getMedia = async (req, res) => {
  const { orderId } = req.params;

  try {
    // Find the order by ID
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Get image and voice URLs from AWS S3
    const imageUrl = order.image;
    const voiceUrl = order.voice;
    const intransitimg = order.intransitImage;
    const intransitvoi = order.intransitVoice;
    const deliverImage = order.deliverImage;

    res
      .status(200)
      .json({ imageUrl, voiceUrl, intransitimg, intransitvoi, deliverImage });
  } catch (error) {
    console.error("Error fetching media:", error);
    res.status(500).json({ message: "Failed to fetch media" });
  }
};
