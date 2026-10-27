import {
  PrismaClient,
  CarType,
  Transmission,
  VehicleStatus,
  BookingStatus,
  CalendarKind,
  MediaPurpose,
  MediaState,
} from '@prisma/client';

const prisma = new PrismaClient();

// Safeguard against running seed in production
if (process.env.NODE_ENV === 'production') {
  console.error('ERROR: Prisma seed is forbidden in production environment.');
  process.exit(1);
}

// Fixed deterministic UUIDs for test reproducibility
export const DEMO_IDS = {
  USERS: {
    OWNER_1: '00000000-0000-0000-0000-000000000001',
    OWNER_2: '00000000-0000-0000-0000-000000000002',
    RENTER_1: '00000000-0000-0000-0000-000000000003',
    RENTER_2: '00000000-0000-0000-0000-000000000004',
  },
  VEHICLES: [
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000006',
    '10000000-0000-0000-0000-000000000007',
    '10000000-0000-0000-0000-000000000008',
    '10000000-0000-0000-0000-000000000009',
    '10000000-0000-0000-0000-000000000010',
    '10000000-0000-0000-0000-000000000011',
    '10000000-0000-0000-0000-000000000012',
    '10000000-0000-0000-0000-000000000013', // DRAFT vehicle
  ],
  BOOKINGS: {
    COMPLETED: '20000000-0000-0000-0000-000000000001',
    IN_PROGRESS: '20000000-0000-0000-0000-000000000002',
    APPROVED: '20000000-0000-0000-0000-000000000003',
    REQUESTED: '20000000-0000-0000-0000-000000000004',
  },
  CALENDAR: {
    COMPLETED: '30000000-0000-0000-0000-000000000001',
    IN_PROGRESS: '30000000-0000-0000-0000-000000000002',
    APPROVED: '30000000-0000-0000-0000-000000000003',
    OWNER_BLOCK: '30000000-0000-0000-0000-000000000004',
  },
};

async function main() {
  console.log('--- Starting Seed Execution ---');

  // 1. Seed 4 Demo Accounts (Capability model: users can both host and rent)
  const usersData = [
    {
      id: DEMO_IDS.USERS.OWNER_1,
      name: 'Nguyễn Văn Chủ 1',
      emailNormalized: 'owner1@carsharing.local',
      phone: '0901111111',
      passwordHash: '$2b$10$localDemoPasswordHashOwner1PlaceholderSaltV1',
    },
    {
      id: DEMO_IDS.USERS.OWNER_2,
      name: 'Trần Thị Chủ 2',
      emailNormalized: 'owner2@carsharing.local',
      phone: '0902222222',
      passwordHash: '$2b$10$localDemoPasswordHashOwner2PlaceholderSaltV1',
    },
    {
      id: DEMO_IDS.USERS.RENTER_1,
      name: 'Lê Hoàng Thuê 1',
      emailNormalized: 'renter1@carsharing.local',
      phone: '0903333333',
      passwordHash: '$2b$10$localDemoPasswordHashRenter1PlaceholderSaltV1',
    },
    {
      id: DEMO_IDS.USERS.RENTER_2,
      name: 'Phạm Minh Thuê 2',
      emailNormalized: 'renter2@carsharing.local',
      phone: '0904444444',
      passwordHash: '$2b$10$localDemoPasswordHashRenter2PlaceholderSaltV1',
    },
  ];

  for (const u of usersData) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: { name: u.name, phone: u.phone, passwordHash: u.passwordHash },
      create: u,
    });
  }
  console.log(`✓ Seeded ${usersData.length} demo accounts.`);

  // 2. Seed 13 Vehicles (12 PUBLISHED, 1 DRAFT)
  const vehiclesData: Array<{
    id: string;
    ownerId: string;
    brand: string;
    model: string;
    year: number;
    plateNormalized: string;
    city: string;
    pickupAddress: string;
    carType: CarType;
    transmission: Transmission;
    seats: number;
    description: string;
    pricePerDayVnd: bigint;
    keylessSupported: boolean;
    status: VehicleStatus;
    amenities: string[];
  }> = [
    {
      id: DEMO_IDS.VEHICLES[0],
      ownerId: DEMO_IDS.USERS.OWNER_1,
      brand: 'VinFast',
      model: 'VF8 Plus',
      year: 2024,
      plateNormalized: '51K-10001',
      city: 'TP. Hồ Chí Minh',
      pickupAddress: 'Vinhomes Central Park, 208 Nguyễn Hữu Cảnh, Quận Bình Thạnh',
      carType: 'SUV',
      transmission: 'AUTO',
      seats: 5,
      description: 'SUV điện thông minh, công nghệ ADAS hiện đại, hỗ trợ mở khóa tự động Keyless.',
      pricePerDayVnd: BigInt(1400000),
      keylessSupported: true,
      status: 'PUBLISHED',
      amenities: ['GPS', 'BLUETOOTH', 'BACKUP_CAMERA', 'SUNROOF', 'DASH_CAM', 'ETC'],
    },
    {
      id: DEMO_IDS.VEHICLES[1],
      ownerId: DEMO_IDS.USERS.OWNER_1,
      brand: 'Hyundai',
      model: 'Santa Fe Cao Cấp',
      year: 2023,
      plateNormalized: '51K-10002',
      city: 'TP. Hồ Chí Minh',
      pickupAddress: 'Saigon Centre, 65 Lê Lợi, Phường Bến Nghé, Quận 1',
      carType: 'SUV',
      transmission: 'AUTO',
      seats: 7,
      description: 'Xe gia đình 7 chỗ rộng rãi, cách âm tốt, động cơ SmartStream vận hành êm ái.',
      pricePerDayVnd: BigInt(1600000),
      keylessSupported: true,
      status: 'PUBLISHED',
      amenities: ['GPS', 'BLUETOOTH', 'BACKUP_CAMERA', 'SUNROOF', 'ETC'],
    },
    {
      id: DEMO_IDS.VEHICLES[2],
      ownerId: DEMO_IDS.USERS.OWNER_1,
      brand: 'Toyota',
      model: 'Camry 2.5Q',
      year: 2023,
      plateNormalized: '51K-10003',
      city: 'TP. Hồ Chí Minh',
      pickupAddress: 'Crescent Mall, 101 Tôn Dật Tiên, Tân Phú, Quận 7',
      carType: 'SEDAN',
      transmission: 'AUTO',
      seats: 5,
      description: 'Sedan sang trọng, lịch lãm phù hợp gặp đối tác và du lịch công tác.',
      pricePerDayVnd: BigInt(1500000),
      keylessSupported: false,
      status: 'PUBLISHED',
      amenities: ['GPS', 'BLUETOOTH', 'BACKUP_CAMERA', 'ETC'],
    },
    {
      id: DEMO_IDS.VEHICLES[3],
      ownerId: DEMO_IDS.USERS.OWNER_1,
      brand: 'Mazda',
      model: 'CX-5 2.0 Premium',
      year: 2024,
      plateNormalized: '51K-10004',
      city: 'TP. Hồ Chí Minh',
      pickupAddress: 'Sân bay Tân Sơn Nhất, Quận Tân Bình',
      carType: 'CROSSOVER',
      transmission: 'AUTO',
      seats: 5,
      description: 'Crossover thiết kế KODO tinh tế, nội thất bọc da cao cấp, loa Bose.',
      pricePerDayVnd: BigInt(1200000),
      keylessSupported: true,
      status: 'PUBLISHED',
      amenities: ['GPS', 'BLUETOOTH', 'BACKUP_CAMERA', 'SUNROOF', 'ETC'],
    },
    {
      id: DEMO_IDS.VEHICLES[4],
      ownerId: DEMO_IDS.USERS.OWNER_1,
      brand: 'VinFast',
      model: 'VF3',
      year: 2024,
      plateNormalized: '51K-10005',
      city: 'TP. Hồ Chí Minh',
      pickupAddress: 'Landmark 81, Quận Bình Thạnh',
      carType: 'SUV',
      transmission: 'AUTO',
      seats: 4,
      description: 'Xe mini điện nhỏ gọn, dễ luồn lách nội đô, chi phí năng lượng siêu tiết kiệm.',
      pricePerDayVnd: BigInt(600000),
      keylessSupported: true,
      status: 'PUBLISHED',
      amenities: ['BLUETOOTH', 'BACKUP_CAMERA', 'ETC'],
    },
    {
      id: DEMO_IDS.VEHICLES[5],
      ownerId: DEMO_IDS.USERS.OWNER_1,
      brand: 'Kia',
      model: 'Carnival Signature',
      year: 2023,
      plateNormalized: '51K-10006',
      city: 'TP. Hồ Chí Minh',
      pickupAddress: 'Khu đô thị Sala, Mai Chí Thọ, TP. Thủ Đức',
      carType: 'MPV',
      transmission: 'AUTO',
      seats: 7,
      description: 'Chuyên cơ mặt đất, ghế thương gia ngả lưng chỉnh điện, màn hình trần.',
      pricePerDayVnd: BigInt(2200000),
      keylessSupported: false,
      status: 'PUBLISHED',
      amenities: ['GPS', 'BLUETOOTH', 'BACKUP_CAMERA', 'SUNROOF', 'DASH_CAM', 'ETC'],
    },
    {
      id: DEMO_IDS.VEHICLES[6],
      ownerId: DEMO_IDS.USERS.OWNER_1,
      brand: 'Mitsubishi',
      model: 'Xpander Cross',
      year: 2023,
      plateNormalized: '51K-10007',
      city: 'TP. Hồ Chí Minh',
      pickupAddress: 'Bến xe Miền Đông mới, TP. Thủ Đức',
      carType: 'MPV',
      transmission: 'AUTO',
      seats: 7,
      description: 'MPV 7 chỗ thực dụng, gầm cao 225mm, tiết kiệm nhiên liệu tối đa.',
      pricePerDayVnd: BigInt(950000),
      keylessSupported: false,
      status: 'PUBLISHED',
      amenities: ['GPS', 'BLUETOOTH', 'BACKUP_CAMERA', 'ETC'],
    },
    // Hà Nội vehicles (4 PUBLISHED)
    {
      id: DEMO_IDS.VEHICLES[7],
      ownerId: DEMO_IDS.USERS.OWNER_2,
      brand: 'VinFast',
      model: 'VF9 Plus',
      year: 2024,
      plateNormalized: '30K-10008',
      city: 'Hà Nội',
      pickupAddress: 'Vinhomes Riverside, Quận Long Biên',
      carType: 'SUV',
      transmission: 'AUTO',
      seats: 6,
      description: 'Full-size SUV điện 6 chỗ cơ trưởng, đẳng cấp thượng lưu, tự hành cấp độ 2.',
      pricePerDayVnd: BigInt(2500000),
      keylessSupported: true,
      status: 'PUBLISHED',
      amenities: ['GPS', 'BLUETOOTH', 'BACKUP_CAMERA', 'SUNROOF', 'DASH_CAM', 'ETC'],
    },
    {
      id: DEMO_IDS.VEHICLES[8],
      ownerId: DEMO_IDS.USERS.OWNER_2,
      brand: 'Toyota',
      model: 'Corolla Cross 1.8V',
      year: 2023,
      plateNormalized: '30K-10009',
      city: 'Hà Nội',
      pickupAddress: 'Lotte Mall West Lake, 272 Võ Chí Công, Quận Tây Hồ',
      carType: 'CROSSOVER',
      transmission: 'AUTO',
      seats: 5,
      description: 'Gói an toàn Toyota Safety Sense, nhập khẩu Thái Lan, vận hành bền bỉ.',
      pricePerDayVnd: BigInt(1100000),
      keylessSupported: true,
      status: 'PUBLISHED',
      amenities: ['GPS', 'BLUETOOTH', 'BACKUP_CAMERA', 'ETC'],
    },
    {
      id: DEMO_IDS.VEHICLES[9],
      ownerId: DEMO_IDS.USERS.OWNER_2,
      brand: 'Honda',
      model: 'CR-V L',
      year: 2024,
      plateNormalized: '30K-10010',
      city: 'Hà Nội',
      pickupAddress: 'Keangnam Hanoi Landmark Tower, Nam Từ Liêm',
      carType: 'CROSSOVER',
      transmission: 'AUTO',
      seats: 7,
      description: 'Động cơ Turbo tăng tốc mạnh mẽ, hệ thống an toàn Honda Sensing.',
      pricePerDayVnd: BigInt(1350000),
      keylessSupported: false,
      status: 'PUBLISHED',
      amenities: ['GPS', 'BLUETOOTH', 'BACKUP_CAMERA', 'SUNROOF', 'ETC'],
    },
    {
      id: DEMO_IDS.VEHICLES[10],
      ownerId: DEMO_IDS.USERS.OWNER_2,
      brand: 'Ford',
      model: 'Everest Titanium+',
      year: 2023,
      plateNormalized: '30K-10011',
      city: 'Hà Nội',
      pickupAddress: 'Sân bay Quốc tế Nội Bài, Sóc Sơn',
      carType: 'SUV',
      transmission: 'AUTO',
      seats: 7,
      description: 'SUV 2 cầu dẫn động 4WD, hộp số 10 cấp, camera 360 toàn cảnh sắc nét.',
      pricePerDayVnd: BigInt(1800000),
      keylessSupported: false,
      status: 'PUBLISHED',
      amenities: ['GPS', 'BLUETOOTH', 'BACKUP_CAMERA', 'SUNROOF', 'DASH_CAM', 'ETC'],
    },
    // Đà Nẵng vehicle (1 PUBLISHED)
    {
      id: DEMO_IDS.VEHICLES[11],
      ownerId: DEMO_IDS.USERS.OWNER_2,
      brand: 'VinFast',
      model: 'VF6 Plus',
      year: 2024,
      plateNormalized: '43A-10012',
      city: 'Đà Nẵng',
      pickupAddress: 'Sân bay Quốc tế Đà Nẵng, Quận Hải Châu',
      carType: 'CROSSOVER',
      transmission: 'AUTO',
      seats: 5,
      description: 'Crossover điện nhỏ gọn, pin 399km, phù hợp dạo biển Mỹ Khê và đi Hội An.',
      pricePerDayVnd: BigInt(1000000),
      keylessSupported: true,
      status: 'PUBLISHED',
      amenities: ['GPS', 'BLUETOOTH', 'BACKUP_CAMERA', 'ETC'],
    },
    // DRAFT vehicle (1 DRAFT - không được hiện trong kết quả search công khai)
    {
      id: DEMO_IDS.VEHICLES[12],
      ownerId: DEMO_IDS.USERS.OWNER_1,
      brand: 'Toyota',
      model: 'Yaris Cross',
      year: 2024,
      plateNormalized: '51K-99999',
      city: 'TP. Hồ Chí Minh',
      pickupAddress: 'Khu công nghệ cao, Quận 9, TP. Thủ Đức',
      carType: 'CROSSOVER',
      transmission: 'AUTO',
      seats: 5,
      description: 'Xe nháp đang chờ hoàn thiện hồ sơ đăng kiểm và chụp ảnh xe.',
      pricePerDayVnd: BigInt(1050000),
      keylessSupported: false,
      status: 'DRAFT',
      amenities: ['GPS', 'BLUETOOTH'],
    },
  ];

  for (const v of vehiclesData) {
    const { amenities, ...vehicleFields } = v;
    await prisma.vehicle.upsert({
      where: { id: v.id },
      update: vehicleFields,
      create: vehicleFields,
    });

    // Seed amenities
    for (const code of amenities) {
      await prisma.vehicleAmenity.upsert({
        where: {
          vehicleId_amenityCode: {
            vehicleId: v.id,
            amenityCode: code,
          },
        },
        update: {},
        create: {
          vehicleId: v.id,
          amenityCode: code,
        },
      });
    }

    // Seed media photo for published vehicles
    if (v.status === 'PUBLISHED') {
      const mediaId = `40000000-0000-0000-0000-${v.id.slice(24)}`;
      await prisma.mediaObject.upsert({
        where: { id: mediaId },
        update: { state: 'VERIFIED' },
        create: {
          id: mediaId,
          uploaderId: v.ownerId,
          purpose: 'VEHICLE_PHOTO',
          vehicleId: v.id,
          stagingKey: `staging/vehicles/${v.id}/cover.jpg`,
          finalKey: `vehicles/${v.id}/cover.jpg`,
          mimeType: 'image/jpeg',
          sizeBytes: 1542000,
          checksum: 'sha256-mock-checksum-v1',
          state: 'VERIFIED',
          verifiedAt: new Date('2026-10-01T00:00:00Z'),
        },
      });

      await prisma.vehiclePhoto.upsert({
        where: {
          vehicleId_mediaId: {
            vehicleId: v.id,
            mediaId,
          },
        },
        update: { position: 1 },
        create: {
          vehicleId: v.id,
          mediaId,
          position: 1,
        },
      });
    }
  }
  console.log(`✓ Seeded ${vehiclesData.length} vehicles (12 PUBLISHED, 1 DRAFT).`);

  // 3. Seed Representative Bookings & Calendar Records
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  // Booking 1: COMPLETED (Quá khứ: 7 ngày trước đến 5 ngày trước)
  const b1Start = new Date(now.getTime() - 7 * dayMs);
  const b1End = new Date(now.getTime() - 5 * dayMs);
  const b1Price = BigInt(1400000);
  const b1Days = 2;
  const b1Subtotal = b1Price * BigInt(b1Days);
  const b1Fee = BigInt(280000);
  const b1Deposit = BigInt(5000000);
  const b1Total = b1Subtotal + b1Fee + b1Deposit;

  await prisma.booking.upsert({
    where: { id: DEMO_IDS.BOOKINGS.COMPLETED },
    update: {},
    create: {
      id: DEMO_IDS.BOOKINGS.COMPLETED,
      vehicleId: DEMO_IDS.VEHICLES[0],
      renterId: DEMO_IDS.USERS.RENTER_1,
      ownerId: DEMO_IDS.USERS.OWNER_1,
      startAt: b1Start,
      endAt: b1End,
      status: 'COMPLETED',
      completedAt: b1End,
      requestExpiresAt: new Date(b1Start.getTime() - dayMs),
    },
  });

  await prisma.pricingSnapshot.upsert({
    where: { bookingId: DEMO_IDS.BOOKINGS.COMPLETED },
    update: {},
    create: {
      id: '50000000-0000-0000-0000-000000000001',
      bookingId: DEMO_IDS.BOOKINGS.COMPLETED,
      currency: 'VND',
      pricePerDayVnd: b1Price,
      rentalDays: b1Days,
      subtotalVnd: b1Subtotal,
      serviceFeeVnd: b1Fee,
      depositVnd: b1Deposit,
      totalVnd: b1Total,
      pricingVersion: '1.0',
    },
  });

  await prisma.vehicleCalendar.upsert({
    where: { id: DEMO_IDS.CALENDAR.COMPLETED },
    update: {},
    create: {
      id: DEMO_IDS.CALENDAR.COMPLETED,
      vehicleId: DEMO_IDS.VEHICLES[0],
      bookingId: DEMO_IDS.BOOKINGS.COMPLETED,
      kind: 'BOOKING',
      startAt: b1Start,
      endAt: b1End,
      releasedAt: b1End, // Đã kết thúc
    },
  });

  // Booking 2: IN_PROGRESS (Bắt đầu sáng nay, kết thúc chiều mai)
  const b2Start = new Date(now.getTime() - 2 * 3600 * 1000); // 2h trước
  const b2End = new Date(now.getTime() + 24 * 3600 * 1000); // Ngày mai
  const b2Price = BigInt(1600000);
  const b2Days = 1;
  const b2Subtotal = b2Price * BigInt(b2Days);
  const b2Fee = BigInt(160000);
  const b2Deposit = BigInt(5000000);
  const b2Total = b2Subtotal + b2Fee + b2Deposit;

  await prisma.booking.upsert({
    where: { id: DEMO_IDS.BOOKINGS.IN_PROGRESS },
    update: {},
    create: {
      id: DEMO_IDS.BOOKINGS.IN_PROGRESS,
      vehicleId: DEMO_IDS.VEHICLES[1],
      renterId: DEMO_IDS.USERS.RENTER_2,
      ownerId: DEMO_IDS.USERS.OWNER_1,
      startAt: b2Start,
      endAt: b2End,
      status: 'IN_PROGRESS',
      requestExpiresAt: new Date(b2Start.getTime() - dayMs),
    },
  });

  await prisma.pricingSnapshot.upsert({
    where: { bookingId: DEMO_IDS.BOOKINGS.IN_PROGRESS },
    update: {},
    create: {
      id: '50000000-0000-0000-0000-000000000002',
      bookingId: DEMO_IDS.BOOKINGS.IN_PROGRESS,
      currency: 'VND',
      pricePerDayVnd: b2Price,
      rentalDays: b2Days,
      subtotalVnd: b2Subtotal,
      serviceFeeVnd: b2Fee,
      depositVnd: b2Deposit,
      totalVnd: b2Total,
      pricingVersion: '1.0',
    },
  });

  await prisma.vehicleCalendar.upsert({
    where: { id: DEMO_IDS.CALENDAR.IN_PROGRESS },
    update: {},
    create: {
      id: DEMO_IDS.CALENDAR.IN_PROGRESS,
      vehicleId: DEMO_IDS.VEHICLES[1],
      bookingId: DEMO_IDS.BOOKINGS.IN_PROGRESS,
      kind: 'BOOKING',
      startAt: b2Start,
      endAt: b2End,
      releasedAt: null, // Đang diễn ra
    },
  });

  // Booking 3: APPROVED (Tương lai: ngày mai đến ngày kia)
  const b3Start = new Date(now.getTime() + 2 * dayMs);
  const b3End = new Date(now.getTime() + 4 * dayMs);
  const b3Price = BigInt(1500000);
  const b3Days = 2;
  const b3Subtotal = b3Price * BigInt(b3Days);
  const b3Fee = BigInt(300000);
  const b3Deposit = BigInt(5000000);
  const b3Total = b3Subtotal + b3Fee + b3Deposit;

  await prisma.booking.upsert({
    where: { id: DEMO_IDS.BOOKINGS.APPROVED },
    update: {},
    create: {
      id: DEMO_IDS.BOOKINGS.APPROVED,
      vehicleId: DEMO_IDS.VEHICLES[2],
      renterId: DEMO_IDS.USERS.RENTER_1,
      ownerId: DEMO_IDS.USERS.OWNER_1,
      startAt: b3Start,
      endAt: b3End,
      status: 'APPROVED',
      requestExpiresAt: new Date(b3Start.getTime() - dayMs),
    },
  });

  await prisma.pricingSnapshot.upsert({
    where: { bookingId: DEMO_IDS.BOOKINGS.APPROVED },
    update: {},
    create: {
      id: '50000000-0000-0000-0000-000000000003',
      bookingId: DEMO_IDS.BOOKINGS.APPROVED,
      currency: 'VND',
      pricePerDayVnd: b3Price,
      rentalDays: b3Days,
      subtotalVnd: b3Subtotal,
      serviceFeeVnd: b3Fee,
      depositVnd: b3Deposit,
      totalVnd: b3Total,
      pricingVersion: '1.0',
    },
  });

  await prisma.vehicleCalendar.upsert({
    where: { id: DEMO_IDS.CALENDAR.APPROVED },
    update: {},
    create: {
      id: DEMO_IDS.CALENDAR.APPROVED,
      vehicleId: DEMO_IDS.VEHICLES[2],
      bookingId: DEMO_IDS.BOOKINGS.APPROVED,
      kind: 'BOOKING',
      startAt: b3Start,
      endAt: b3End,
      releasedAt: null, // Đã duyệt, giữ chỗ
    },
  });

  // Booking 4: REQUESTED (Chưa duyệt, chờ phản hồi)
  const b4Start = new Date(now.getTime() + 5 * dayMs);
  const b4End = new Date(now.getTime() + 7 * dayMs);
  const b4Price = BigInt(1200000);
  const b4Days = 2;
  const b4Subtotal = b4Price * BigInt(b4Days);
  const b4Fee = BigInt(240000);
  const b4Deposit = BigInt(5000000);
  const b4Total = b4Subtotal + b4Fee + b4Deposit;

  await prisma.booking.upsert({
    where: { id: DEMO_IDS.BOOKINGS.REQUESTED },
    update: {},
    create: {
      id: DEMO_IDS.BOOKINGS.REQUESTED,
      vehicleId: DEMO_IDS.VEHICLES[3],
      renterId: DEMO_IDS.USERS.RENTER_2,
      ownerId: DEMO_IDS.USERS.OWNER_1,
      startAt: b4Start,
      endAt: b4End,
      status: 'REQUESTED',
      requestExpiresAt: new Date(now.getTime() + dayMs),
    },
  });

  await prisma.pricingSnapshot.upsert({
    where: { bookingId: DEMO_IDS.BOOKINGS.REQUESTED },
    update: {},
    create: {
      id: '50000000-0000-0000-0000-000000000004',
      bookingId: DEMO_IDS.BOOKINGS.REQUESTED,
      currency: 'VND',
      pricePerDayVnd: b4Price,
      rentalDays: b4Days,
      subtotalVnd: b4Subtotal,
      serviceFeeVnd: b4Fee,
      depositVnd: b4Deposit,
      totalVnd: b4Total,
      pricingVersion: '1.0',
    },
  });

  // Owner Block on Vehicle 4 (Bảo dưỡng 3 ngày tuần sau)
  const blockStart = new Date(now.getTime() + 8 * dayMs);
  const blockEnd = new Date(now.getTime() + 11 * dayMs);

  await prisma.vehicleCalendar.upsert({
    where: { id: DEMO_IDS.CALENDAR.OWNER_BLOCK },
    update: {},
    create: {
      id: DEMO_IDS.CALENDAR.OWNER_BLOCK,
      vehicleId: DEMO_IDS.VEHICLES[4],
      bookingId: null,
      kind: 'OWNER_BLOCK',
      startAt: blockStart,
      endAt: blockEnd,
      reason: 'Bảo dưỡng định kỳ 40.000 km tại đại lý chính hãng',
      releasedAt: null,
    },
  });

  console.log('✓ Seeded representative bookings, pricing snapshots, and calendar entries.');
  console.log('--- Seed Finished Successfully ---');
}

main()
  .catch((e) => {
    console.error('Seed execution error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
