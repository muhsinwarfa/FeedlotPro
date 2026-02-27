export const mockPens = [
  { id: 'pen-1', pen_name: 'Pen A', capacity: 50, active_animal_count: 12, status: 'active' },
  { id: 'pen-2', pen_name: 'Pen B', capacity: 30, active_animal_count: 0, status: 'active' },
  { id: 'pen-inactive', pen_name: 'Old Pen', capacity: 10, active_animal_count: 0, status: 'inactive' },
];

export const mockIngredients = [
  { id: 'ing-1', ingredient_name: 'Maize Silage' },
  { id: 'ing-2', ingredient_name: 'Cottonseed Cake' },
];

export const mockActiveAnimal = {
  id: 'animal-active',
  tag_id: 'KE-2024-001',
  status: 'ACTIVE',
  pen_id: 'pen-1',
  intake_weight: 250,
  current_weight: 275,
  intake_date: '2024-01-15T00:00:00Z',
  breed: 'Boran',
  pens: { pen_name: 'Pen A' },
};

export const mockSickAnimal = { ...mockActiveAnimal, id: 'animal-sick', status: 'SICK' };
export const mockDeadAnimal = { ...mockActiveAnimal, id: 'animal-dead', status: 'DEAD' };
export const mockDispatchedAnimal = { ...mockActiveAnimal, id: 'animal-disp', status: 'DISPATCHED' };
