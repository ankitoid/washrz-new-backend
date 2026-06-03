import Pickup from "../models/pickupSchema.js";
import { createCustomerNotification } from "../controller/customerNotificationController.js";
import customerFcmService from "../services/customerFcmService.js";

export const assignPickupToRider = async ({
  pickupId,
  riderId,
  riderName,
  socket,
}) => {
  const riderDate = new Date().toISOString().split("T")[0];

  const pickup = await Pickup.findByIdAndUpdate(
    pickupId,
    {
      riderName,
      riderDate,
      PickupStatus: "assigned",
      "assignedRider.pickup": {
        riderId,
        riderName,
        assignedAt: new Date(),
      },
    },
    { new: true },
  );

  if (!pickup) {
    throw new Error("Pickup not found");
  }

  if (riderId) {
    socket?.emitToRider?.(riderId, "riderAssignedPickup", { pickup });
  }

  if (pickup.appCustomerId) {
    await createCustomerNotification({
      customerId: pickup.appCustomerId,
      title: "Rider Assigned",
      message: "Keep your items bagged & ready.",
      type: "pickup_Assigned",
      data: {
        pickupId: String(pickup._id),
        screen: "PickupDetails",
      },
    });

    await customerFcmService.sendToCustomer(
      String(pickup.appCustomerId),
      {
        title: "Rider Assigned",
        body: "Keep items bagged & ready. Your laundry's escape plan is in motion!",
      },
      {
        type: "pickup_Assigned",
        pickupId: String(pickup._id),
        screen: "PickupDetails",
      },
    );
  }

  return pickup;
};