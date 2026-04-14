const buildProcess = (categoryLabel, itemLabel) => [
  {
    step: 1,
    heading: "Pickup & inspection",
    description: `${itemLabel} is received, tagged, and inspected under the ${categoryLabel} workflow.`,
  },
  {
    step: 2,
    heading: "Service processing",
    description: `${itemLabel} goes through the required cleaning and handling process with quality checks.`,
  },
  {
    step: 3,
    heading: "Finishing & dispatch",
    description: `${itemLabel} is finished, packed, and prepared for final delivery.`,
  },
];

const buildMedia = (fileName) =>
  fileName
    ? [
        {
          url: fileName,
          key: `seed/${fileName}`,
          originalName: fileName,
          mimeType: "image/jpeg",
          size: 0,
          kind: "image",
        },
      ]
    : [];

const buildItem = (categorySlug, categoryLabel, item, index) => ({
  sacid: `SAC-${categorySlug.toUpperCase()}-${String(index + 1).padStart(3, "0")}`,
  sku: `SKU-${categorySlug.toUpperCase()}-${String(index + 1).padStart(4, "0")}`,
  slug: `${categorySlug}-${String(index + 1).padStart(4, "0")}`,
  label: item.label,
  mainHeading: item.label,
  mainDescription: `${item.label} is available under ${categoryLabel} with transparent pricing and process visibility.`,
  price: item.price,
  displayPrice: item.displayPrice,
  unit: item.displayPrice?.toLowerCase().includes("/kg") ? "kg" : "pc",
  type: item.type,
  process: buildProcess(categoryLabel, item.label),
  images: buildMedia(item.image),
  videos: [],
  isActive: true,
  sortOrder: index + 1,
});

export const catalogSeed = [
  {
    label: "Laundry",
    slug: "laundry",
    mainHeading: "Laundry Services",
    mainDescription: "Daily laundry services with category-wise pricing, process details, and media-ready item records.",
    sortOrder: 1,
    items: [
      { label: "W & F(Wearables)", price: 80, displayPrice: "80/kg", type: "laundry", image: "w_f_wearable.jpg" },
      { label: "W & F(Non-Wearables)", price: 100, displayPrice: "100/kg", type: "laundry", image: "w_f_non-wearable.jpg" },
      { label: "W & I(Wearables)", price: 100, displayPrice: "100/kg", type: "laundry", image: "w_i_wearable.jpg" },
      { label: "W & I(Non-Wearables)", price: 120, displayPrice: "120/kg", type: "laundry", image: "w_i_non-wearable.jpg" },
    ],
  },
  {
    label: "DryClean",
    slug: "dryclean",
    mainHeading: "Dry Clean Services",
    mainDescription: "Premium dry clean catalog with item-level pricing, structured process steps, and media support.",
    sortOrder: 2,
    items: [
      { label: "Shirt/T-shirt", price: 100, displayPrice: "100/pc", type: "DryClean", image: "shirt.png" },
      { label: "Jeans", price: 120, displayPrice: "120/pc", type: "DryClean", image: "jeans.png" },
      { label: "Trousers", price: 100, displayPrice: "100/pc", type: "DryClean", image: "trouser.png" },
      { label: "Blazer/Jacket", price: 250, displayPrice: "250/pc", type: "DryClean", image: "blazer.png" },
      { label: "3 piece Suit", price: 450, displayPrice: "450/pc", type: "DryClean", image: "3_pc_suit.png" },
      { label: "2 piece Suit", price: 300, displayPrice: "300/pc", type: "DryClean", image: "2_pc_suit.png" },
      { label: "Long Blazer", price: 350, displayPrice: "350/pc", type: "DryClean", image: "longblazer.png" },
      { label: "Sweatshirt /Hoodie", price: 250, displayPrice: "250/pc", type: "DryClean", image: "hoodie.png" },
      { label: "Winter Jacket", price: 350, displayPrice: "350/pc", type: "DryClean", image: "winter_jacket.jpg" },
      { label: "Heavy Saree", price: 350, displayPrice: "350/pc", type: "DryClean", image: "heavysaree.png" },
      { label: "Medium Saree", price: 300, displayPrice: "300/pc", type: "DryClean", image: "mediumsaree.png" },
      { label: "Saree", price: 250, displayPrice: "250/pc", type: "DryClean", image: "saree.png" },
      { label: "Blouse", price: 80, displayPrice: "80/pc", type: "DryClean", image: "blouse.png" },
      { label: "Heavy Blouse", price: 120, displayPrice: "120/pc", type: "DryClean", image: "heavy_blouse.webp" },
      { label: "Lehnga", price: 250, displayPrice: "250/pc", type: "DryClean", image: "lehenga.png" },
      { label: "Medium Lehnga", price: 500, displayPrice: "500/pc", type: "DryClean", image: "mediumlehenga.png" },
      { label: "Heavy Lehnga", price: 700, displayPrice: "700/pc", type: "DryClean", image: "heavy_lehenga.jpg" },
      { label: "Heavy Dress", price: 500, displayPrice: "500/pc", type: "DryClean", image: "heavy_dress.jpg" },
      { label: "Dress", price: 350, displayPrice: "350/pc", type: "DryClean", image: "dress.png" },
      { label: "Heavy Gown", price: 300, displayPrice: "300/pc", type: "DryClean", image: "heavy_gown.jpg" },
      { label: "Gown", price: 200, displayPrice: "200/pc", type: "DryClean", image: "gown.jpg" },
      { label: "Dupatta", price: 80, displayPrice: "80/pc", type: "DryClean", image: "dupatta.jpg" },
      { label: "Heavy Dupatta", price: 100, displayPrice: "100/pc", type: "DryClean", image: "heavy_duptta.jpg" },
      { label: "Kurta Pyjama", price: 250, displayPrice: "250/pc", type: "DryClean", image: "kurta_pajama.jpg" },
      { label: "Shawl", price: 200, displayPrice: "200/pc", type: "DryClean", image: "shwal.jpg" },
      { label: "Sweater /Cardigan", price: 200, displayPrice: "200/pc", type: "DryClean", image: "cardigin.jpg" },
      { label: "Shrug", price: 200, displayPrice: "200/pc", type: "DryClean", image: "srug.jpg" },
      { label: "Leather Jackets", price: 450, displayPrice: "450/pc", type: "DryClean", image: "leather_jacket.jpg" },
      { label: "Belt", price: 150, displayPrice: "150/pc", type: "DryClean", image: "belt.jpg" },
      { label: "Leather Belt", price: 250, displayPrice: "250/pc", type: "DryClean", image: "leather_belt.webp" },
      { label: "Pillow Cover", price: 50, displayPrice: "50/pc", type: "DryClean", image: "pillow_cover.jpg" },
      { label: "Large Pillow", price: 100, displayPrice: "100/pc", type: "DryClean", image: "large_pillow.jpg" },
      { label: "Small Pillow", price: 60, displayPrice: "60/pc", type: "DryClean", image: "small_pillow.jpg" },
      { label: "Blanket(single)", price: 300, displayPrice: "300/pc", type: "DryClean", image: "blanket(single).jpg" },
      { label: "Blanket(double)", price: 400, displayPrice: "400/pc", type: "DryClean", image: "double_blanket.jpg" },
      { label: "Duvet(single)", price: 300, displayPrice: "300/pc", type: "DryClean", image: "Druvet_single.jpg" },
      { label: "Duvet(double)", price: 400, displayPrice: "400/pc", type: "DryClean", image: "Druvet_double.jpg" },
      { label: "Quilt(single)", price: 350, displayPrice: "350/pc", type: "DryClean", image: "Quilt_single.jpg" },
      { label: "Quilt(double)", price: 450, displayPrice: "450/pc", type: "DryClean", image: "Quilt_double.jpg" },
      { label: "Bed Cover(single)", price: 250, displayPrice: "250/pc", type: "DryClean", image: "bed_cover_single.jpg" },
      { label: "Bed Cover(double)", price: 350, displayPrice: "350/pc", type: "DryClean", image: "bed_cover_double.jpg" },
      { label: "Bed Sheet(single)", price: 200, displayPrice: "200/pc", type: "DryClean", image: "bed_sheet_single.jpg" },
      { label: "Bed Sheet(double)", price: 300, displayPrice: "300/pc", type: "DryClean", image: "bed_sheet_double.jpg" },
      { label: "Handbag(Small)", price: 300, displayPrice: "300/pc", type: "DryClean", image: "handbag_small.jpeg" },
      { label: "Handbag(Medium)", price: 450, displayPrice: "450/pc", type: "DryClean", image: "handbag_medium.jpg" },
      { label: "Handbag(Large)", price: 450, displayPrice: "450/pc", type: "DryClean", image: "handbag_large.jpg" },
      { label: "Sports Bag", price: 400, displayPrice: "400/pc", type: "DryClean", image: "sports_bag.jpg" },
      { label: "Leather Bag(Small)", price: 400, displayPrice: "400/pc", type: "DryClean", image: "Leatherbag_small.webp" },
      { label: "Leather Bag(Large)", price: 700, displayPrice: "700/pc", type: "DryClean", image: "leather_bag_large.jpg" },
    ],
  },
  {
    label: "ShoeSpa",
    slug: "shoespa",
    mainHeading: "Shoe Spa Services",
    mainDescription: "Specialized shoe care catalog with item details, process visibility, and media support for each service.",
    sortOrder: 3,
    items: [
      { label: "Sport Shoes / Sneakers", price: 500, displayPrice: "500/pc", type: "ShoeSpa", image: "sportsshoes.png" },
      { label: "Leather Shoes", price: 600, displayPrice: "600/pc", type: "ShoeSpa", image: "leather_shoes.jpg" },
      { label: "Suede Shoes", price: 600, displayPrice: "600/pc", type: "ShoeSpa", image: "suedeshoes.png" },
      { label: "Boots", price: 700, displayPrice: "700/pc", type: "ShoeSpa", image: "boots.png" },
      { label: "Stilettos", price: 600, displayPrice: "600/pc", type: "ShoeSpa", image: "stilettos.png" },
      { label: "Sliders", price: 250, displayPrice: "250/pc", type: "ShoeSpa", image: "sliders.png" },
      { label: "Sandals", price: 300, displayPrice: "300/pc", type: "ShoeSpa", image: "sandals.png" },
    ],
  },
].map((category) => ({
  ...category,
  items: category.items.map((item, index) =>
    buildItem(category.slug, category.label, item, index)
  ),
}));

export default catalogSeed;
