import Orders from "../models/orderSchema.js";

export const customer_services = {};

const getItemType = (item) => item?.itemId?.type || item?.type || null;

const getItemQuantity = (item) => {
  const quantity = Number(item?.quantity);
  return quantity > 0 ? quantity : 1;
};

const getItemTotalPrice = (item) =>
  Number(item?.price || 0) * getItemQuantity(item);

customer_services.customerOrdersDetails = async (req, res) => {
  let phone = req.params.phone;

  const check_phone = phone.slice(0, 2);

  if (check_phone !== "91") {
    phone = "91" + phone;
  }

  let total_cost_laundry = 0;
  let total_cost_dryclean = 0;
  let total_cost_shoespa = 0;
  let total_number_of_orders = 0;
  let total_orders_value = 0;
  let avg_orders_value = 0;

  const orders = await Orders.find({ contactNo: phone }).populate({
    path: "items.itemId",
    select: "type",
  });
  console.log("this is the orders--->>>", orders);

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const itemType = getItemType(item);
      const itemTotalPrice = getItemTotalPrice(item);
      const itemQuantity = getItemQuantity(item);

      total_number_of_orders = total_number_of_orders + itemQuantity;

      if (itemType === "shoespa") {
        total_cost_shoespa = total_cost_shoespa + itemTotalPrice;
      } else if (itemType === "laundry") {
        total_cost_laundry = total_cost_laundry + itemTotalPrice;
      } else if (itemType === "dryclean") {
        total_cost_dryclean = total_cost_dryclean + itemTotalPrice;
      }
    });
  });

  total_orders_value =
    total_cost_laundry + total_cost_dryclean + total_cost_shoespa;

  avg_orders_value =
    total_number_of_orders > 0
      ? Math.ceil(total_orders_value / total_number_of_orders)
      : 0;

  return res.status(200).json({
    data: {
      total_cost_laundry,
      total_cost_dryclean,
      total_cost_shoespa,
      total_number_of_orders,
      avg_orders_value,
      total_orders_value,
      orders,
    },
  });
};
