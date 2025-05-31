# Some of the photos in birds are not good. This usually means we errroed while fetching the bird.
# This script will remove them.

# Iterate through all birds in the birds directory.
# If the photo is bad, delete it and also remove the bird from the bird_photo_authors.json file.

require 'json'
require 'fileutils'
require "byebug"

birds = File.readlines('bird_names.txt').map(&:strip)
bird_photo_authors = JSON.parse(File.read("data/bird_photo_authors.json"))
birds.each do |bird|
  bird_scientific_name = bird.split('_').first
  image_path = "data/birds/#{bird_scientific_name.gsub(' ', '_')}.jpg"
  if !File.exist?(image_path)
    bird_photo_authors.delete(bird_scientific_name)
    next
  end

  # Use `file` to check if the image is a JPEG.
  image_type = `file --mime-type -b #{image_path}`.strip
  if image_type != "image/jpeg"
    puts "Bird #{bird} is not a JPEG"
    File.delete(image_path)
    bird_photo_authors.delete(bird_scientific_name)
  end
end

File.write("data/bird_photo_authors.json", bird_photo_authors.to_json)
