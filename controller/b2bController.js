import B2b from "../models/b2bModel.js";
import AppError from "../utills/appError.js";

export const createB2bRequest = async (req, res, next) => {
  try {
    const { orgType, orgName, contactPerson, phone, email, requirements } = req.body;
    console.log("Received B2B request:", req.body);

    if (!orgName || !contactPerson || !phone) {
      return next(new AppError("Organization name, contact person, and phone are required", 400));
    }

    const b2bRequest = await B2b.create({
      orgType,
      orgName,
      contactPerson,
      phone,
      email,
      requirements,
    });

    if (req.socket) {
      req.socket.emitToAdmin("newB2bRequest", b2bRequest);
    }

    res.status(201).json({
      success: true,
      message: "B2B Request submitted successfully",
      data: b2bRequest,
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

export const getAllB2bRequests = async (req, res, next) => {
  try {
    const requests = await B2b.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

export const updateB2bRequestStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const request = await B2b.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!request) {
      return next(new AppError("Request not found", 404));
    }

    res.status(200).json({
      success: true,
      data: request,
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};
