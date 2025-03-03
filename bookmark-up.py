import json
import os
from collections import defaultdict
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
import psutil
import shutil
import time
from html import escape  # For HTML-safe bookmark names/URLs

__version__ = "1.6"  # Version for this script

nltk.download('punkt')
nltk.download('punkt_tab')
nltk.download('stopwords')

BRAVE_BOOKMARKS_PATH = os.path.expanduser(
    "~/Library/Application Support/BraveSoftware/Brave-Browser/Default/Bookmarks"
)

def is_brave_running():
    """Check if Brave Browser is running on the system."""
    for proc in psutil.process_iter(['name']):
        if 'Brave' in proc.info['name']:
            return True
    return False

print(f"Targeting Bookmarks file at: {BRAVE_BOOKMARKS_PATH}")
print(f"Welcome to Bookmark Up v{__version__}! Crafted by The Taxidermist at AD:HOC Codeworks—let’s mount those bookmarks beautifully!")

def load_bookmarks():
    """Read the Brave Bookmarks JSON file into a Python dictionary."""
    with open(BRAVE_BOOKMARKS_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)

def extract_bookmarks(node, bookmarks_list=None):
    """Recursively extract all URL bookmarks from the JSON structure."""
    if bookmarks_list is None:
        bookmarks_list = []
    if isinstance(node, dict):
        if "children" in node:
            for child in node["children"]:
                if child["type"] == "url":
                    bookmarks_list.append(child)
                elif child["type"] == "folder":
                    extract_bookmarks(child, bookmarks_list)
        else:
            for key in node:
                extract_bookmarks(node[key], bookmarks_list)
    return bookmarks_list

def simple_semantic_grouping(bookmarks):
    """Group bookmarks by shared keywords in their names."""
    stop_words = set(stopwords.words('english'))
    groups = defaultdict(list)
    for bookmark in bookmarks:
        words = word_tokenize(bookmark["name"].lower())
        keywords = [w for w in words if w not in stop_words and len(w) > 3]
        group_name = min(keywords) if keywords else "misc"
        groups[group_name].append(bookmark)
    final_groups = defaultdict(list)
    for group_name, items in groups.items():
        if len(items) >= 2 or group_name == "misc":
            final_groups[group_name].extend(items)
        else:
            final_groups["misc"].extend(items)
    return final_groups

def build_new_structure(original_data, groups):
    """Build a fresh bookmark hierarchy from grouped bookmarks."""
    new_data = {
        "checksum": original_data.get("checksum", ""),
        "roots": {
            "bookmark_bar": {"children": [], "name": "Bookmark Bar", "type": "folder"},
            "other": {"children": [], "name": "Other Bookmarks", "type": "folder"},
            "synced": {"children": [], "name": "Synced Bookmarks", "type": "folder"}
        },
        "version": original_data.get("version", 1)
    }
    for group_name, bookmarks in groups.items():
        folder = {
            "children": bookmarks,
            "name": group_name.capitalize(),
            "type": "folder",
            "date_added": bookmarks[0]["date_added"]
        }
        new_data["roots"]["bookmark_bar"]["children"].append(folder)
    return new_data

def save_bookmarks(new_data):
    """Save the new structure and create an HTML backup."""
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.expanduser(f"~/Desktop/BookmarkUp_Backup_{timestamp}.html")
    
    # Generate HTML backup (Netscape Bookmark File Format)
    with open(backup_path, 'w', encoding='utf-8') as f:
        f.write("<!DOCTYPE NETSCAPE-Bookmark-file-1>\n")
        f.write("<META HTTP-EQUIV=\"Content-Type\" CONTENT=\"text/html; charset=UTF-8\">\n")
        f.write("<TITLE>Bookmarks</TITLE>\n")
        f.write("<H1>Bookmarks</H1>\n")
        f.write("<DL><p>\n")
        for folder in new_data["roots"]["bookmark_bar"]["children"]:
            f.write(f"    <DT><H3>{escape(folder['name'])}</H3>\n")
            f.write("    <DL><p>\n")
            for bookmark in folder["children"]:
                f.write(f"        <DT><A HREF=\"{escape(bookmark['url'])}\">{escape(bookmark['name'])}</A>\n")
            f.write("    </DL><p>\n")
        f.write("</DL><p>\n")
    print(f"Backup created at: {backup_path} (HTML format—importable by Brave!)")
    
    # Save new JSON structure
    print("Attempting to save new bookmark structure...")
    with open(BRAVE_BOOKMARKS_PATH, 'w', encoding='utf-8') as f:
        json.dump(new_data, f, indent=2)
    print(f"Saved to {BRAVE_BOOKMARKS_PATH}! Relaunch Brave to see The Taxidermist’s handiwork!")

def main():
    """Main function to orchestrate bookmark organization."""
    if is_brave_running():
        print("WARNING: Brave is running! Close all instances.")
        input("Press Enter to continue once Brave is closed, or Ctrl+C to abort: ")
        if is_brave_running():
            print("Brave’s still lurking! Aborting.")
            return
    data = load_bookmarks()
    bookmarks = extract_bookmarks(data["roots"])
    print(f"Found {len(bookmarks)} bookmarks to organize!")
    grouped_bookmarks = simple_semantic_grouping(bookmarks)
    print(f"Mounted into {len(grouped_bookmarks)} categories by AD:HOC Codeworks!")
    new_structure = build_new_structure(data, grouped_bookmarks)
    save_bookmarks(new_structure)

if __name__ == "__main__":
    """Entry point: run the script with error handling."""
    try:
        main()
    except FileNotFoundError:
        print("Oops! Couldn’t find your Brave Bookmarks file. Check the path!")
    except PermissionError:
        print("Yikes! No permission to write. Try sudo or check perms!")
    except Exception as e:
        print(f"Uh-oh, taxidermy gone wrong: {e}")