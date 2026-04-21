import Orders from "../models/orderSchema.js"
import User from "../models/userModel.js";

export const customer_services = {}


customer_services.customerOrdersDetails = async (req,res) =>
{ 
  let phone = req.params.phone

  const check_phone =  phone.slice(0,2)

  if(check_phone !== "91"){
    phone = "91" + phone
  }

  
  let total_cost_laundry = 0;
  let total_cost_dryclean = 0;
  let total_cost_shoespa = 0;
  let total_number_of_orders = 0;
  let total_orders_value = 0;
  let avg_orders_value = 0;

  console.log('phone',phone)



  const orders =  await Orders.find({contactNo:phone})

     console.log("this is the orders--->>>",orders)

   const data =  orders.forEach((el)=>
    { 
        
        el.items.forEach((el)=>{
        total_number_of_orders = total_number_of_orders + 1
        if(el.type == "shoespa")
        {
        total_cost_shoespa =  total_cost_shoespa + (el?.price * el?.quantity)
        }
        else if(el.type == "laundry")
        {
          total_cost_laundry =  total_cost_laundry + (el?.price * el?.quantity)
        }
        else if(el.type == "dryclean")
        {
          total_cost_dryclean =  total_cost_dryclean + (el?.price * el?.quantity)
        }
      })
    })
  total_orders_value = total_cost_laundry + total_cost_dryclean + total_cost_shoespa;

  avg_orders_value = Math.ceil(total_orders_value/total_number_of_orders)


   return res.status(200).json({data: {
    total_cost_laundry : total_cost_laundry,
    total_cost_dryclean : total_cost_dryclean,
    total_cost_shoespa : total_cost_shoespa,
    total_number_of_orders : total_number_of_orders,
    avg_orders_value : avg_orders_value,
    total_orders_value : total_orders_value,
    orders : orders
   }})
}

