import bcrypt from 'bcrypt';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, closeDatabase, migrate } from './index.js';
const demoAccounts = [
    { role: 'customer', name: 'Aminul Islam', email: 'customer@shusthobazaar.demo', password: 'Customer123!' },
    { role: 'seller', name: 'Nusrat Jahan', email: 'seller@shusthobazaar.demo', password: 'Seller123!' },
    { role: 'seller', name: 'Tanvir Rahman', email: 'seller2@shusthobazaar.demo', password: 'Seller2123!' },
    { role: 'admin', name: 'ShusthoBazaar Admin', email: 'admin@shusthobazaar.demo', password: 'Admin123!' },
];
// Demo pharmacies. Seller id 2 keeps the original catalogue; products listed in
// `productNames` are sold by the second pharmacy so carts can span vendors.
const pharmacies = [
    {
        id: 2,
        email: 'seller@shusthobazaar.demo',
        name: 'Lazz Pharma Dhanmondi',
        license: 'DEMO-DGDA-0002',
        address: 'Dhanmondi, Dhaka',
        latitude: 23.7465,
        longitude: 90.3760,
    },
    {
        id: 3,
        email: 'seller2@shusthobazaar.demo',
        name: 'Tamanna Pharmacy Mirpur',
        license: 'DEMO-DGDA-0010',
        address: 'Mirpur 10, Dhaka',
        latitude: 23.8069,
        longitude: 90.3687,
        productNames: new Set([
            'Alatrol 10mg',
            'Fexo 120mg',
            'Rhinil 10mg',
            'Ceevit 250mg',
            'Becosules',
            'Zinc 20mg',
            'Calbo-D',
            'Povidone-Iodine 10%',
        ]),
    },
];
const categories = [
    'OTC • Fever & Pain',
    'Gastric Care',
    'Respiratory & Asthma',
    'Allergy Care',
    'Vitamins & Supplements',
    'First Aid',
];
const products = [
    ['Napa Extra', 'Paracetamol 500mg + Caffeine 65mg', 'Commonly stocked pain and fever relief medicine.', 35, 150, 0, 'OTC • Fever & Pain', '/images/napa-extra-paracetamol-box-and-tablet-strip.webp'],
    ['Seclo 20mg', 'Omeprazole 20mg', 'Medicine for acid-related digestive conditions.', 70, 80, 1, 'Gastric Care', '/images/Seclo-20-20mg-300x300.webp'],
    ['Monas 10mg', 'Montelukast 10mg', 'Prescription medicine for respiratory and allergy conditions.', 160, 45, 1, 'Respiratory & Asthma', '/images/Monas-10-mg-Tab-600x600w.jpg.webp'],
    ['Sergel 20mg', 'Esomeprazole 20mg', 'Medicine for acid-related digestive conditions.', 80, 120, 0, 'Gastric Care', '/images/UOl4mayzRy3e1bz91Q4h4rqSxeIkw2WgrVWJ4cxk.webp'],
    ['Napa 500mg', 'Paracetamol 500mg', 'Commonly stocked pain and fever relief medicine.', 20, 200, 0, 'OTC • Fever & Pain', '/images/napa-extra-paracetamol-box-and-tablet-strip.webp'],
    ['Ace 500mg', 'Paracetamol 500mg', 'Commonly stocked pain and fever relief medicine.', 18, 175, 0, 'OTC • Fever & Pain', '/images/napa-extra-paracetamol-box-and-tablet-strip.webp'],
    ['Napa Extend', 'Paracetamol 665mg', 'Extended-release paracetamol tablets.', 30, 95, 0, 'OTC • Fever & Pain', '/images/napa-extra-paracetamol-box-and-tablet-strip.webp'],
    ['Alatrol 10mg', 'Cetirizine 10mg', 'Antihistamine medicine for allergy symptoms.', 30, 90, 0, 'Allergy Care', '/images/Seclo-20-20mg-300x300.webp'],
    ['Fexo 120mg', 'Fexofenadine 120mg', 'Antihistamine medicine for allergy symptoms.', 90, 60, 1, 'Allergy Care', '/images/Monas-10-mg-Tab-600x600w.jpg.webp'],
    ['Rhinil 10mg', 'Loratadine 10mg', 'Antihistamine medicine for allergy symptoms.', 40, 75, 0, 'Allergy Care', '/images/Seclo-20-20mg-300x300.webp'],
    ['Pantonix 20mg', 'Pantoprazole 20mg', 'Medicine for acid-related digestive conditions.', 65, 50, 1, 'Gastric Care', '/images/UOl4mayzRy3e1bz91Q4h4rqSxeIkw2WgrVWJ4cxk.webp'],
    ['Losectil 20mg', 'Omeprazole 20mg', 'Medicine for acid-related digestive conditions.', 55, 70, 1, 'Gastric Care', '/images/Seclo-20-20mg-300x300.webp'],
    ['Amodis 400mg', 'Metronidazole 400mg', 'Prescription medicine; use only as directed by a clinician.', 45, 40, 1, 'OTC • Fever & Pain', '/images/napa-extra-paracetamol-box-and-tablet-strip.webp'],
    ['Ceevit 250mg', 'Ascorbic acid 250mg', 'Vitamin C supplement tablets.', 15, 140, 0, 'Vitamins & Supplements', '/images/Monas-10-mg-Tab-600x600w.jpg.webp'],
    ['Becosules', 'B-complex vitamins', 'Vitamin B-complex supplement capsules.', 60, 110, 0, 'Vitamins & Supplements', '/images/UOl4mayzRy3e1bz91Q4h4rqSxeIkw2WgrVWJ4cxk.webp'],
    ['Zinc 20mg', 'Zinc 20mg', 'Zinc supplement tablets.', 25, 100, 0, 'Vitamins & Supplements', '/images/Monas-10-mg-Tab-600x600w.jpg.webp'],
    ['ORS Saline', 'Oral rehydration salts', 'Oral rehydration salts sachet.', 8, 250, 0, 'OTC • Fever & Pain', '/images/napa-extra-paracetamol-box-and-tablet-strip.webp'],
    ['Calbo-D', 'Calcium + Vitamin D3', 'Calcium and vitamin D supplement tablets.', 120, 65, 0, 'Vitamins & Supplements', '/images/UOl4mayzRy3e1bz91Q4h4rqSxeIkw2WgrVWJ4cxk.webp'],
    ['Mucolyt 100mg', 'Acebrophylline 100mg', 'Prescription medicine for respiratory conditions.', 100, 30, 1, 'Respiratory & Asthma', '/images/Monas-10-mg-Tab-600x600w.jpg.webp'],
    ['Salbutamol Inhaler', 'Salbutamol 100mcg/dose', 'Prescription inhaler for respiratory conditions.', 250, 25, 1, 'Respiratory & Asthma', '/images/Monas-10-mg-Tab-600x600w.jpg.webp'],
    ['Antacid Suspension', 'Aluminium hydroxide + Magnesium hydroxide', 'Antacid suspension for occasional indigestion.', 95, 55, 0, 'Gastric Care', '/images/Seclo-20-20mg-300x300.webp'],
    ['Povidone-Iodine 10%', 'Povidone-iodine', 'Antiseptic solution for external use.', 85, 35, 0, 'First Aid', '/images/napa-extra-paracetamol-box-and-tablet-strip.webp'],
];
function seed() {
    migrate();
    if (db.prepare('SELECT COUNT(*) AS count FROM roles').get().count > 0)
        return;
    const insertRole = db.prepare('INSERT INTO roles (name) VALUES (?)');
    const insertUser = db.prepare('INSERT INTO users (role_id, full_name, email, password_hash, phone) VALUES (?, ?, ?, ?, ?)');
    const insertSeller = db.prepare(`INSERT INTO sellers (id, user_id, pharmacy_name, drug_license_no, address_line, city, latitude, longitude, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved')`);
    const insertCategory = db.prepare('INSERT INTO categories (name) VALUES (?)');
    const insertProduct = db.prepare(`INSERT INTO products
      (seller_id, category_id, name, generic_name, description, price, stock_qty, requires_prescription)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const insertImage = db.prepare('INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, 0)');
    const insertCoupon = db.prepare(`INSERT INTO coupons (code, discount_type, discount_value, min_order_amt, valid_from, valid_to)
     VALUES (?, ?, ?, ?, ?, ?)`);
    const transaction = db.transaction(() => {
        const roleIds = new Map();
        for (const role of ['customer', 'seller', 'admin']) {
            roleIds.set(role, Number(insertRole.run(role).lastInsertRowid));
        }
        const userIds = new Map();
        for (const account of demoAccounts) {
            const passwordHash = bcrypt.hashSync(account.password, 12);
            const result = insertUser.run(roleIds.get(account.role), account.name, account.email, passwordHash, null);
            userIds.set(account.email, Number(result.lastInsertRowid));
        }
        for (const pharmacy of pharmacies) {
            insertSeller.run(pharmacy.id, userIds.get(pharmacy.email), pharmacy.name, pharmacy.license, pharmacy.address, 'Dhaka', pharmacy.latitude, pharmacy.longitude);
        }
        const sellerIdFor = (productName) => pharmacies.find((pharmacy) => pharmacy.productNames?.has(productName))?.id ?? pharmacies[0].id;
        const categoryIds = new Map();
        for (const category of categories) {
            categoryIds.set(category, Number(insertCategory.run(category).lastInsertRowid));
        }
        for (const [name, generic, description, price, stock, requiresPrescription, category, image] of products) {
            const productId = Number(insertProduct.run(sellerIdFor(name), categoryIds.get(category), name, generic, description, price * 100, stock, requiresPrescription).lastInsertRowid);
            insertImage.run(productId, image);
        }
        const now = new Date();
        const validFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const validTo = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
        insertCoupon.run('WELCOME10', 'percent', 10, 5000, validFrom, validTo);
        insertCoupon.run('SAVE50', 'fixed', 5000, 20000, validFrom, validTo);
    });
    transaction();
}
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
    try {
        seed();
        console.log('Database seed complete.');
    }
    finally {
        closeDatabase();
    }
}
export { seed };
