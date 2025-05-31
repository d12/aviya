# We'll use Avibase for this. There are three steps per bird:
# 1. Use the searcdh endpoint to find the avibase id. https://avibase.bsc-eoc.org/api/v2/ref/search/species?term=veery
# 2. Use the image endpoint to get a list of images. https://avibase.bsc-eoc.org/taxon_tree_json.jsp?avibaseID=663E3315&ssver=1&checklist=
# 3. Download an image.

require 'byebug'
require 'net/http'
require 'json'
require 'uri'
require 'fileutils'
require 'concurrent-ruby'

birds = File.readlines('bird_names.txt').map(&:strip)
photo_authors = JSON.parse(File.read("data/bird_photo_authors.json"))

MAX_CONCURRENCY = 10
progress = Concurrent::AtomicFixnum.new(0)
total = birds.size

def remove_qualifiers_from_bird_name(bird_name)
  bird_name.split(" (").first.split(" [").first
end

def pick_best_match_from_search(search_results, scientific_name)
  if match = search_results.find { |result| remove_qualifiers_from_bird_name(result["label"]) == scientific_name }
    return match
  end
  search_results.first
end

# Thread pool and futures
pool = Concurrent::FixedThreadPool.new(MAX_CONCURRENCY)
promises = []

birds.each do |bird|
  promises << Concurrent::Promise.execute(executor: pool) do
    bird_scientific_name = bird.split('_').first

    # Skip if we already have a photo for this bird.
    if photo_authors[bird_scientific_name]
      progress.increment
      puts "Progress: #{progress.value}/#{total}"
      next
    end

    bird_scientific_name_url_safe = URI.encode_www_form_component(bird_scientific_name)

    puts "Processing #{bird}..."

    # 1. Search for avibase ID
    uri = URI("https://avibase.bsc-eoc.org/api/v2/ref/search/species?term=#{bird_scientific_name_url_safe}")
    response = Net::HTTP.get(uri)
    data = JSON.parse(response)

    if data.empty?
      puts "No results for #{bird_scientific_name}"
      progress.increment
      puts "Progress: #{progress.value}/#{total}"
      next
    end

    match = pick_best_match_from_search(data, bird_scientific_name)
    avibase_id = match["value"]
    avibase_name = remove_qualifiers_from_bird_name(match["label"])
    avibase_name_url_safe = URI.encode_www_form_component(avibase_name)

    # 2. Get image list
    uri = URI("https://avibase.bsc-eoc.org/flickr_img_json.jsp?name=#{avibase_name_url_safe}")
    response = Net::HTTP.get(uri)
    data = JSON.parse(response)

    photo = data[0]
    unless photo
      puts "No photo for #{bird_scientific_name}"
      progress.increment
      puts "Progress: #{progress.value}/#{total}"
      next
    end

    image_url = photo["thumbnail"]
    image_path = "data/birds/#{bird_scientific_name.gsub(' ', '_')}.jpg"
    FileUtils.mkdir_p(File.dirname(image_path))
    image_data = Net::HTTP.get(URI(image_url))

    if image_data && !image_data.empty?
      File.write(image_path, image_data)
      photo_authors[bird_scientific_name] = photo["author"]
      File.write("data/bird_photo_authors.json", photo_authors.to_json)
    else
      puts "Failed to download photo for #{bird_scientific_name}"
    end

    progress.increment
    puts "Progress: #{progress.value}/#{total}"
  rescue => e
    puts "Error processing #{bird}: #{e.message}"
    progress.increment
    puts "Progress: #{progress.value}/#{total}"
  end
end

# Wait for all to finish
Concurrent::Promise.zip(*promises).value!
pool.shutdown
pool.wait_for_termination

