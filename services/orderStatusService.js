import Order from "../models/orderSchema.js";

export const ORDER_STATUS = {
  INTRANSIT: "intransit",
  PROCESSING: "processing",
  REPROCESSING: "reprocessing",
  READY_FOR_DELIVERY: "ready for delivery",
  DELIVERY_RIDER_ASSIGNED: "delivery rider assigned",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
};

const STATUS_ALIASES = {
  intransit: ORDER_STATUS.INTRANSIT,
  processing: ORDER_STATUS.PROCESSING,
  reprocessing: ORDER_STATUS.REPROCESSING,
  readyfordelivery: ORDER_STATUS.READY_FOR_DELIVERY,
  "ready for delivery": ORDER_STATUS.READY_FOR_DELIVERY,
  ready_for_delivery: ORDER_STATUS.READY_FOR_DELIVERY,
  deliveryriderassigned: ORDER_STATUS.DELIVERY_RIDER_ASSIGNED,
  "delivery rider assigned": ORDER_STATUS.DELIVERY_RIDER_ASSIGNED,
  delivered: ORDER_STATUS.DELIVERED,
  cancelled: ORDER_STATUS.CANCELLED,
};

const STATUS_HISTORY_KEYS = {
  [ORDER_STATUS.INTRANSIT]: "intransit",
  [ORDER_STATUS.PROCESSING]: "processing",
  [ORDER_STATUS.REPROCESSING]: "reprocessing",
  [ORDER_STATUS.READY_FOR_DELIVERY]: "readyForDelivery",
  [ORDER_STATUS.DELIVERY_RIDER_ASSIGNED]: "deliveryriderassigned",
  [ORDER_STATUS.DELIVERED]: "delivered",
  [ORDER_STATUS.CANCELLED]: "cancelled",
};

const STATUS_RANK = {
  [ORDER_STATUS.INTRANSIT]: 0,
  [ORDER_STATUS.PROCESSING]: 1,
  [ORDER_STATUS.REPROCESSING]: 2,
  [ORDER_STATUS.READY_FOR_DELIVERY]: 3,
  [ORDER_STATUS.DELIVERY_RIDER_ASSIGNED]: 4,
  [ORDER_STATUS.DELIVERED]: 5,
};

export const normalizeOrderStatus = (status) => {
  if (!status) return null;

  const normalizedKey = String(status).trim().toLowerCase();
  return STATUS_ALIASES[normalizedKey] || null;
};

export const getValidOrderStatuses = () => Object.values(ORDER_STATUS);

const stampStatusHistory = (history, status, at = new Date()) => {
  const key = STATUS_HISTORY_KEYS[status];

  if (!key) return;

  history[key] = at;

  if (status === ORDER_STATUS.DELIVERY_RIDER_ASSIGNED) {
    history.deliveryriderassigned = at;
    history.out_for_delivery = at;
  }

  if (status === ORDER_STATUS.READY_FOR_DELIVERY) {
    history.ready_for_delivery = at;
  }
};

const ensureItemHistory = (item) => {
  if (!item.statusHistory) {
    item.statusHistory = {};
  }
  return item.statusHistory;
};

const ensureOrderHistory = (order) => {
  if (!order.statusHistory) {
    order.statusHistory = {};
  }
  return order.statusHistory;
};

const applyStatusToItem = (item, status, at = new Date()) => {
  item.status = status;
  stampStatusHistory(ensureItemHistory(item), status, at);
};

export const deriveOrderStatusFromItems = (items = [], fallbackStatus = ORDER_STATUS.INTRANSIT) => {
  const normalizedStatuses = items
    .map((item) => normalizeOrderStatus(item?.status))
    .filter(Boolean);

  if (!normalizedStatuses.length) {
    return fallbackStatus;
  }

  const activeStatuses = normalizedStatuses.filter(
    (status) => status !== ORDER_STATUS.CANCELLED,
  );

  if (!activeStatuses.length) {
    return ORDER_STATUS.CANCELLED;
  }

  return activeStatuses.reduce((lowest, current) =>
    STATUS_RANK[current] < STATUS_RANK[lowest] ? current : lowest,
  );
};

const resolveOrderItem = (order, { lineId, orderItemId }) => {
  if (lineId) {
    return order.items.find((item) => item.lineId === lineId) || null;
  }

  if (orderItemId) {
    return (
      order.items.find((item) => String(item._id) === String(orderItemId)) || null
    );
  }

  return null;
};

const syncOrderStatusFromItems = (order, at = new Date()) => {
  const derivedStatus = deriveOrderStatusFromItems(
    order.items,
    normalizeOrderStatus(order.status) || ORDER_STATUS.INTRANSIT,
  );
  const previousStatus = normalizeOrderStatus(order.status);

  order.status = derivedStatus;

  if (previousStatus !== derivedStatus) {
    stampStatusHistory(ensureOrderHistory(order), derivedStatus, at);
  }

  return {
    previousStatus,
    nextStatus: derivedStatus,
  };
};

export const updateOrderStatusByItems = async ({
  orderId,
  status,
  lineId,
  orderItemId,
}) => {
  const normalizedStatus = normalizeOrderStatus(status);

  if (!normalizedStatus) {
    const error = new Error("Invalid status provided.");
    error.statusCode = 400;
    throw error;
  }

  const order = await Order.findById(orderId);

  if (!order) {
    const error = new Error("Order not found.");
    error.statusCode = 404;
    throw error;
  }

  const previousOrderStatus = normalizeOrderStatus(order.status);
  const at = new Date();
  let updatedItem = null;

  if (order.items?.length) {
    if (lineId || orderItemId) {
      updatedItem = resolveOrderItem(order, { lineId, orderItemId });

      if (!updatedItem) {
        const error = new Error("Order item not found.");
        error.statusCode = 404;
        throw error;
      }

      applyStatusToItem(updatedItem, normalizedStatus, at);
    } else {
      order.items.forEach((item) => {
        const currentStatus = normalizeOrderStatus(item.status);
        if (
          currentStatus === ORDER_STATUS.CANCELLED &&
          normalizedStatus !== ORDER_STATUS.CANCELLED
        ) {
          return;
        }
        applyStatusToItem(item, normalizedStatus, at);
      });
    }

    syncOrderStatusFromItems(order, at);
  } else {
    order.status = normalizedStatus;
    stampStatusHistory(ensureOrderHistory(order), normalizedStatus, at);
  }

  await order.save();

  return {
    order,
    updatedItem,
    previousOrderStatus,
    nextOrderStatus: normalizeOrderStatus(order.status),
  };
};
